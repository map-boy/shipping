import { onCall, HttpsError } from "firebase-functions/v2/https";
import { timingSafeEqual } from "crypto";
import { db } from "./lib/db";
import { requireString } from "./lib/validate";
import { buildOfferUpdates, clearDispatchUpdates } from "./dispatch";
import { tripEventUpdate } from "./lib/events";

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function checkAdminCreds(username: unknown, password: unknown) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  // Without this guard an unset env var makes `undefined !== undefined` false
  // and every admin endpoint opens up to anonymous callers.
  if (!expectedUser || !expectedPass) {
    console.error("ADMIN_USERNAME / ADMIN_PASSWORD are not configured; refusing admin call.");
    throw new HttpsError("failed-precondition", "Admin access is not configured on this server.");
  }
  if (typeof username !== "string" || typeof password !== "string") {
    throw new HttpsError("permission-denied", "Invalid admin credentials.");
  }
  if (!safeEquals(username, expectedUser) || !safeEquals(password, expectedPass)) {
    throw new HttpsError("permission-denied", "Invalid admin credentials.");
  }
}

function guard(request: { data?: Record<string, unknown> }) {
  checkAdminCreds(request.data?.username, request.data?.password);
}

export const adminLogin = onCall(async (request) => {
  guard(request);
  return { ok: true };
});

export const adminListTrips = onCall(async (request) => {
  guard(request);
  const snap = await db.ref("trips").get();
  const val = snap.val() || {};
  return { trips: Object.entries(val).map(([id, t]) => ({ id, ...(t as object) })) };
});

export const adminListDrivers = onCall(async (request) => {
  guard(request);
  const snap = await db.ref("drivers").get();
  const val = snap.val() || {};
  return { drivers: Object.entries(val).map(([id, d]) => ({ id, ...(d as object) })) };
});

export const adminListBans = onCall(async (request) => {
  guard(request);
  const snap = await db.ref("bannedUsers").get();
  return { bans: snap.val() || {} };
});

export const adminMarketplace = onCall(async (request) => {
  guard(request);
  const [market, demand, analytics] = await Promise.all([
    db.ref("marketplace").get(),
    db.ref("openDemand").get(),
    db.ref("analytics").limitToLast(14).get(),
  ]);
  return {
    areas: market.val() || {},
    openDemand: demand.val() || {},
    analytics: analytics.val() || {},
  };
});

export const adminDeleteTrip = onCall(async (request) => {
  guard(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const snap = await db.ref(`trips/${tripId}`).get();
  const trip = snap.val();

  const updates: Record<string, unknown> = { [`trips/${tripId}`]: null, [`openDemand/${tripId}`]: null };
  if (trip) Object.assign(updates, clearDispatchUpdates(tripId, trip));
  if (trip?.riderId) updates[`activeTrips/${trip.riderId}`] = null;
  if (trip?.driverId) {
    updates[`activeTrips/${trip.driverId}`] = null;
    updates[`drivers/${trip.driverId}/activeTripId`] = null;
  }

  await db.ref().update(updates);
  return { ok: true };
});

export const adminSetUserBan = onCall(async (request) => {
  guard(request);
  const userId = requireString(request.data?.userId, "userId");
  const { banned, reason } = request.data ?? {};

  if (banned) {
    await db.ref(`bannedUsers/${userId}`).set({
      bannedAt: Date.now(),
      reason: typeof reason === "string" ? reason.slice(0, 280) : "",
    });
  } else {
    await db.ref(`bannedUsers/${userId}`).remove();
  }
  return { ok: true };
});

export const adminSetDriverStatus = onCall(async (request) => {
  guard(request);
  const driverId = requireString(request.data?.driverId, "driverId");
  const status = requireString(request.data?.status, "status");
  if (status !== "online" && status !== "busy" && status !== "offline") {
    throw new HttpsError("invalid-argument", "status must be online, busy or offline.");
  }
  await db.ref(`drivers/${driverId}/status`).set(status);
  return { ok: true };
});

/**
 * Sweeps the dispatch queue: expires dead requests, advances stalled offers, and
 * releases scheduled (first/second class) work once its window opens. Point a
 * scheduler at this, or call it by hand.
 */
export const adminDispatchSweep = onCall(async (request) => {
  guard(request);
  const now = Date.now();
  const snap = await db.ref("trips").get();
  const trips = (snap.val() || {}) as Record<string, Record<string, unknown>>;

  let expired = 0;
  let advanced = 0;

  for (const [tripId, trip] of Object.entries(trips)) {
    if (trip.status !== "requested") continue;

    const expiresAt = trip.expiresAt as number | undefined;
    const promisedFrom = trip.promisedFrom as number | undefined;
    const offerExpiresAt = trip.offerExpiresAt as number | undefined;
    const serviceClass = trip.serviceClass as string | undefined;

    if (serviceClass === "express" && typeof expiresAt === "number" && expiresAt < now) {
      const record = { ...trip, status: "expired", completedAt: now };
      await db.ref().update({
        [`trips/${tripId}`]: null,
        [`openDemand/${tripId}`]: null,
        [`tripHistory/${trip.riderId as string}/${tripId}`]: record,
        [`activeTrips/${trip.riderId as string}`]: null,
        ...clearDispatchUpdates(tripId, trip),
        ...tripEventUpdate(tripId, { type: "offer_expired", at: now, data: { reason: "request-ttl" } }),
      });
      expired += 1;
      continue;
    }

    // Scheduled classes wait until their window opens before tying up a driver.
    const dueNow = serviceClass === "express" || (typeof promisedFrom === "number" && promisedFrom <= now);
    if (!dueNow) continue;

    const offerLive = typeof offerExpiresAt === "number" && offerExpiresAt > now;
    if (offerLive) continue;

    const next = await buildOfferUpdates(tripId, trip as never);
    if (next) {
      await db.ref().update(next);
      advanced += 1;
    }
  }

  return { expired, advanced, scanned: Object.keys(trips).length };
});
