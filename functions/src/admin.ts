import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";

/** Admin calls are rare, so they reserve almost no CPU. */
const ADMIN_OPTS = { maxInstances: 1 } as const;
import { db } from "./lib/db";
import { requireString } from "./lib/validate";
import { clearDispatchUpdates } from "./dispatch";
import { sweepDispatch } from "./scheduled";

/**
 * Only these signed-in emails may call admin endpoints. request.auth is set
 * by the platform after verifying the caller's Firebase ID token signature,
 * so this cannot be spoofed from the client. Add more emails here later.
 */
const ADMIN_EMAILS = new Set(["techubwenge@gmail.com"]);

function guard(request: CallableRequest) {
  const email = request.auth?.token?.email;
  if (!request.auth || typeof email !== "string" || !ADMIN_EMAILS.has(email.toLowerCase())) {
    throw new HttpsError("permission-denied", "Admin access only.");
  }
}

export const adminListTrips = onCall(ADMIN_OPTS, async (request) => {
  guard(request);
  const snap = await db.ref("trips").get();
  const val = snap.val() || {};
  return { trips: Object.entries(val).map(([id, t]) => ({ id, ...(t as object) })) };
});

export const adminListDrivers = onCall(ADMIN_OPTS, async (request) => {
  guard(request);
  const snap = await db.ref("drivers").get();
  const val = snap.val() || {};
  return { drivers: Object.entries(val).map(([id, d]) => ({ id, ...(d as object) })) };
});

export const adminListBans = onCall(ADMIN_OPTS, async (request) => {
  guard(request);
  const snap = await db.ref("bannedUsers").get();
  return { bans: snap.val() || {} };
});

export const adminMarketplace = onCall(ADMIN_OPTS, async (request) => {
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

export const adminDeleteTrip = onCall(ADMIN_OPTS, async (request) => {
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

export const adminSetUserBan = onCall(ADMIN_OPTS, async (request) => {
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

export const adminSetDriverStatus = onCall(ADMIN_OPTS, async (request) => {
  guard(request);
  const driverId = requireString(request.data?.driverId, "driverId");
  const status = requireString(request.data?.status, "status");
  if (status !== "online" && status !== "busy" && status !== "offline") {
    throw new HttpsError("invalid-argument", "status must be online, busy or offline.");
  }
  await db.ref(`drivers/${driverId}/status`).set(status);
  return { ok: true };
});

/** Manual trigger for the same sweep the scheduler runs every two minutes. */
export const adminDispatchSweep = onCall(ADMIN_OPTS, async (request) => {
  guard(request);
  return await sweepDispatch();
});
