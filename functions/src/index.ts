import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import axios from "axios";
import { randomUUID, timingSafeEqual } from "crypto";

initializeApp();
const db = getDatabase();

const MOMO_ENV = process.env.MOMO_ENV || "sandbox";
const MOMO_BASE_URL = MOMO_ENV === "production"
  ? "https://proxy.momoapi.mtn.com"
  : "https://sandbox.momodeveloper.mtn.com";

/** How long a "requested" trip stays visible to drivers before it is treated as stale. */
const TRIP_TTL_MS = 15 * 60 * 1000;

export type VehicleType = "standard" | "truck" | "vip";

const FARE_TABLE: Record<VehicleType, { base: number; perKm: number }> = {
  standard: { base: 500, perKm: 300 },
  truck: { base: 1500, perKm: 600 },
  vip: { base: 2500, perKm: 900 },
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  return request.auth.uid;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value.trim();
}

function isLatLng(value: unknown): value is { lat: number; lng: number } {
  const p = value as { lat?: unknown; lng?: unknown } | null;
  return (
    !!p &&
    typeof p.lat === "number" && Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && p.lng >= -180 && p.lng <= 180
  );
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function geohashEncode(lat: number, lng: number, precision = 9): string {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "", bit = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) { ch |= (1 << (4 - bit)); lngMin = mid; } else { lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) { ch |= (1 << (4 - bit)); latMin = mid; } else { latMax = mid; }
    }
    even = !even;
    if (bit < 4) { bit++; } else { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

async function assertNotBanned(uid: string) {
  const banned = await db.ref(`bannedUsers/${uid}`).get();
  if (banned.exists()) {
    throw new HttpsError("permission-denied", "Your account has been suspended.");
  }
}

/** Reads a trip and fails loudly if it is gone. */
async function getTrip(tripId: string) {
  const snap = await db.ref(`trips/${tripId}`).get();
  if (!snap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  return snap.val();
}

// ---------------------------------------------------------------------------
// trip lifecycle
// ---------------------------------------------------------------------------

export const createTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  await assertNotBanned(uid);

  const { tripType, vehicleType, pickup, destination, goodsDescription } = request.data ?? {};

  if (tripType !== "person" && tripType !== "goods") {
    throw new HttpsError("invalid-argument", "tripType must be 'person' or 'goods'.");
  }
  if (typeof vehicleType !== "string" || !(vehicleType in FARE_TABLE)) {
    throw new HttpsError("invalid-argument", "Unknown vehicleType.");
  }
  if (!isLatLng(pickup) || !isLatLng(destination)) {
    throw new HttpsError("invalid-argument", "pickup and destination must be valid coordinates.");
  }
  if (goodsDescription !== undefined && typeof goodsDescription !== "string") {
    throw new HttpsError("invalid-argument", "goodsDescription must be a string.");
  }

  const distanceKmRaw = haversineKm(pickup, destination);
  if (distanceKmRaw > 500) {
    throw new HttpsError("invalid-argument", "That trip is too long to book here.");
  }

  const { base, perKm } = FARE_TABLE[vehicleType as VehicleType];
  const price = Math.round(base + distanceKmRaw * perKm);
  const distanceKm = Math.round(distanceKmRaw * 10) / 10;
  const pickupGeohash = geohashEncode(pickup.lat, pickup.lng);
  const createdAt = Date.now();
  const expiresAt = createdAt + TRIP_TTL_MS;
  const description = typeof goodsDescription === "string" ? goodsDescription.slice(0, 280) : undefined;

  const tripRef = db.ref("trips").push();
  const tripId = tripRef.key as string;

  const trip = {
    riderId: uid,
    tripType,
    vehicleType,
    pickup: { lat: pickup.lat, lng: pickup.lng },
    destination: { lat: destination.lat, lng: destination.lng },
    pickupGeohash,
    distanceKm,
    price,
    status: "requested",
    driverId: null,
    createdAt,
    expiresAt,
    ...(description ? { goodsDescription: description } : {}),
  };

  // The public board carries no rider identity and no drop-off address: a driver
  // only needs to know where to collect, what it is, and what it pays.
  const openTrip = {
    tripType,
    vehicleType,
    pickup: { lat: pickup.lat, lng: pickup.lng },
    pickupGeohash,
    distanceKm,
    price,
    createdAt,
    expiresAt,
    ...(description ? { goodsDescription: description } : {}),
  };

  await db.ref().update({
    [`trips/${tripId}`]: trip,
    [`openTrips/${tripId}`]: openTrip,
    [`activeTrips/${uid}`]: tripId,
  });

  return { tripId, distanceKm, price };
});

export const acceptTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  await assertNotBanned(uid);
  const tripId = requireString(request.data?.tripId, "tripId");

  const existing = await db.ref(`activeTrips/${uid}`).get();
  if (existing.exists() && existing.val() !== tripId) {
    const other = await db.ref(`trips/${existing.val()}`).get();
    if (other.exists() && other.val().driverId === uid && other.val().status !== "completed") {
      throw new HttpsError("failed-precondition", "Finish your current trip before accepting another.");
    }
  }

  // Only one driver can flip "requested" -> "accepted"; everyone else loses the race.
  const claim = await db.ref(`trips/${tripId}`).transaction((current) => {
    if (current === null) return current;
    if (current.status !== "requested") return undefined;
    if (current.riderId === uid) return undefined;
    current.status = "accepted";
    current.driverId = uid;
    current.acceptedAt = Date.now();
    return current;
  });

  if (!claim.committed || !claim.snapshot.exists()) {
    throw new HttpsError("aborted", "Another driver already took that trip.");
  }

  await db.ref().update({
    [`openTrips/${tripId}`]: null,
    [`activeTrips/${uid}`]: tripId,
  });

  return { ok: true, tripId };
});

export const startTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can start this trip.");
  }
  if (trip.status !== "accepted") {
    throw new HttpsError("failed-precondition", "Trip must be accepted before it can start.");
  }

  await db.ref(`trips/${tripId}`).update({ status: "in_progress", startedAt: Date.now() });
  return { ok: true };
});

export const cancelTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  const isRider = trip.riderId === uid;
  const isDriver = trip.driverId === uid;
  if (!isRider && !isDriver) {
    throw new HttpsError("permission-denied", "You are not part of this trip.");
  }
  if (trip.status === "in_progress" || trip.status === "completed") {
    throw new HttpsError("failed-precondition", "A trip that is already under way cannot be cancelled here.");
  }
  if (trip.paymentStatus === "successful") {
    throw new HttpsError("failed-precondition", "This trip is already paid for.");
  }

  const cancelledAt = Date.now();
  const record = {
    ...trip,
    status: "cancelled",
    cancelledAt,
    cancelledBy: isRider ? "rider" : "driver",
    completedAt: cancelledAt,
  };

  const updates: Record<string, unknown> = {
    [`trips/${tripId}`]: null,
    [`openTrips/${tripId}`]: null,
    [`tripHistory/${trip.riderId}/${tripId}`]: record,
    [`activeTrips/${trip.riderId}`]: null,
  };

  if (isDriver) {
    // The driver dropped it: put the job back on the board for someone else.
    updates[`trips/${tripId}`] = { ...trip, status: "requested", driverId: null, acceptedAt: null };
    updates[`openTrips/${tripId}`] = {
      tripType: trip.tripType,
      vehicleType: trip.vehicleType,
      pickup: trip.pickup,
      pickupGeohash: trip.pickupGeohash,
      distanceKm: trip.distanceKm,
      price: trip.price,
      createdAt: trip.createdAt,
      expiresAt: Date.now() + TRIP_TTL_MS,
      ...(trip.goodsDescription ? { goodsDescription: trip.goodsDescription } : {}),
    };
    delete updates[`tripHistory/${trip.riderId}/${tripId}`];
    updates[`activeTrips/${trip.riderId}`] = tripId;
    updates[`activeTrips/${uid}`] = null;
  } else if (trip.driverId) {
    updates[`tripHistory/${trip.driverId}/${tripId}`] = record;
    updates[`activeTrips/${trip.driverId}`] = null;
  }

  await db.ref().update(updates);
  return { ok: true, requeued: isDriver };
});

export const completeTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can complete this trip.");
  }
  if (trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Trip must be in progress to complete.");
  }
  if (trip.paymentStatus !== "successful" && trip.paymentStatus !== "cash") {
    throw new HttpsError("failed-precondition", "Payment must be completed before finishing the trip.");
  }

  const completedAt = Date.now();
  const record = { ...trip, status: "completed", completedAt };

  // The live trip leaves `trips` so the driver board stays small, but both sides
  // keep a permanent receipt they can read back.
  await db.ref().update({
    [`trips/${tripId}`]: null,
    [`openTrips/${tripId}`]: null,
    [`tripHistory/${trip.riderId}/${tripId}`]: record,
    [`tripHistory/${uid}/${tripId}`]: record,
    [`activeTrips/${trip.riderId}`]: null,
    [`activeTrips/${uid}`]: null,
  });

  return { ok: true, completedAt };
});

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------

async function getMomoToken(): Promise<string> {
  const apiUser = process.env.MOMO_API_USER;
  const apiKey = process.env.MOMO_API_KEY;
  const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;
  if (!apiUser || !apiKey || !subscriptionKey) {
    throw new HttpsError("failed-precondition", "Mobile Money is not configured on the server.");
  }

  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");
  try {
    const res = await axios.post(
      `${MOMO_BASE_URL}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Ocp-Apim-Subscription-Key": subscriptionKey,
        },
      }
    );
    return res.data.access_token;
  } catch (err) {
    console.error("MoMo token error:", axios.isAxiosError(err) ? err.response?.data : err);
    throw new HttpsError("internal", "Could not authenticate with Mobile Money.");
  }
}

/** MTN returns free-form casing; only these four values ever reach the database. */
function normalizeMomoStatus(raw: unknown): "pending" | "successful" | "failed" {
  const value = String(raw ?? "").toLowerCase();
  if (value === "successful") return "successful";
  if (value === "pending") return "pending";
  return "failed";
}

function normalizeRwandaMsisdn(raw: unknown): string {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  const msisdn = digits.startsWith("250")
    ? digits
    : digits.startsWith("0")
    ? `250${digits.slice(1)}`
    : digits.startsWith("7")
    ? `250${digits}`
    : digits;
  if (!/^2507[0-9]{8}$/.test(msisdn)) {
    throw new HttpsError("invalid-argument", "Enter a valid Rwandan Mobile Money number, e.g. 0781234567.");
  }
  return msisdn;
}

export const requestMomoPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const phoneNumber = normalizeRwandaMsisdn(request.data?.phoneNumber);

  const trip = await getTrip(tripId);

  if (trip.riderId !== uid) {
    throw new HttpsError("permission-denied", "You do not own this trip.");
  }
  if (trip.status !== "accepted" && trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Wait for a driver to accept before paying.");
  }
  if (trip.paymentStatus === "pending" || trip.paymentStatus === "successful" || trip.paymentStatus === "cash") {
    throw new HttpsError("failed-precondition", "Payment already requested or completed for this trip.");
  }

  const amount = trip.price;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("failed-precondition", "Trip has no valid price set.");
  }

  const referenceId = randomUUID();
  const token = await getMomoToken();

  try {
    await axios.post(
      `${MOMO_BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount: String(amount),
        currency: MOMO_ENV === "production" ? "RWF" : "EUR",
        externalId: tripId,
        payer: { partyIdType: "MSISDN", partyId: phoneNumber },
        payerMessage: "TikTak trip payment",
        payeeNote: `Payment for trip ${tripId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": MOMO_ENV,
          "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("MoMo requesttopay error:", axios.isAxiosError(err) ? err.response?.data : err);
    throw new HttpsError("internal", "Mobile Money rejected the payment request.");
  }

  await db.ref(`trips/${tripId}`).update({
    paymentStatus: "pending",
    paymentReferenceId: referenceId,
    paymentAmount: amount,
    paymentCreatedAt: Date.now(),
  });

  return { referenceId };
});

export const checkMomoPaymentStatus = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");

  const trip = await getTrip(tripId);

  // Without these two checks any signed-in user could stamp "successful" onto
  // somebody else's trip using a reference id from a payment they made themselves.
  if (trip.riderId !== uid && trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "You are not part of this trip.");
  }
  if (!trip.paymentReferenceId) {
    throw new HttpsError("failed-precondition", "No payment has been requested for this trip.");
  }

  const referenceId: string = trip.paymentReferenceId;
  const token = await getMomoToken();

  let status: "pending" | "successful" | "failed";
  try {
    const res = await axios.get(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": MOMO_ENV,
        "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
      },
    });
    if (res.data?.externalId && res.data.externalId !== tripId) {
      throw new HttpsError("failed-precondition", "That payment belongs to a different trip.");
    }
    status = normalizeMomoStatus(res.data?.status);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("MoMo status check error:", axios.isAxiosError(err) ? err.response?.data : err);
    throw new HttpsError("internal", "Could not check payment status.");
  }

  await db.ref(`trips/${tripId}/paymentStatus`).set(status);
  return { status };
});

export const markCashPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can do this.");
  }
  if (trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Trip must be in progress to mark cash payment.");
  }
  if (trip.paymentStatus === "successful") {
    throw new HttpsError("failed-precondition", "This trip was already paid via Mobile Money.");
  }
  if (trip.paymentStatus === "pending") {
    throw new HttpsError("failed-precondition", "A Mobile Money payment is still pending on this trip.");
  }

  await db.ref(`trips/${tripId}`).update({ paymentStatus: "cash", paymentAmount: trip.price });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function checkAdminCreds(username: unknown, password: unknown) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  // Without this guard, an unset env var makes `undefined !== undefined` false and
  // every admin endpoint opens up to anonymous callers.
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

export const adminLogin = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
  return { ok: true };
});

export const adminListTrips = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
  const snap = await db.ref("trips").get();
  const val = snap.val() || {};
  const trips = Object.entries(val).map(([id, t]) => ({ id, ...(t as object) }));
  return { trips };
});

export const adminListDrivers = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
  const snap = await db.ref("drivers").get();
  const val = snap.val() || {};
  const drivers = Object.entries(val).map(([id, d]) => ({ id, ...(d as object) }));
  return { drivers };
});

export const adminListBans = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
  const snap = await db.ref("bannedUsers").get();
  return { bans: snap.val() || {} };
});

export const adminDeleteTrip = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
  const tripId = requireString(request.data?.tripId, "tripId");
  const snap = await db.ref(`trips/${tripId}`).get();
  const trip = snap.val();

  const updates: Record<string, unknown> = {
    [`trips/${tripId}`]: null,
    [`openTrips/${tripId}`]: null,
  };
  if (trip?.riderId) updates[`activeTrips/${trip.riderId}`] = null;
  if (trip?.driverId) updates[`activeTrips/${trip.driverId}`] = null;

  await db.ref().update(updates);
  return { ok: true };
});

export const adminSetUserBan = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
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
  checkAdminCreds(request.data?.username, request.data?.password);
  const driverId = requireString(request.data?.driverId, "driverId");
  const status = requireString(request.data?.status, "status");
  if (status !== "online" && status !== "busy" && status !== "offline") {
    throw new HttpsError("invalid-argument", "status must be online, busy or offline.");
  }
  await db.ref(`drivers/${driverId}/status`).set(status);
  return { ok: true };
});

/** Sweeps requested trips nobody picked up, so the driver board never fills with ghosts. */
export const adminExpireStaleTrips = onCall(async (request) => {
  checkAdminCreds(request.data?.username, request.data?.password);
  const now = Date.now();
  const snap = await db.ref("trips").get();
  const trips = (snap.val() || {}) as Record<string, { status?: string; expiresAt?: number; riderId?: string }>;

  const updates: Record<string, unknown> = {};
  let expired = 0;
  for (const [tripId, trip] of Object.entries(trips)) {
    if (trip.status !== "requested") continue;
    if (typeof trip.expiresAt === "number" && trip.expiresAt > now) continue;
    updates[`trips/${tripId}`] = null;
    updates[`openTrips/${tripId}`] = null;
    if (trip.riderId) updates[`activeTrips/${trip.riderId}`] = null;
    expired += 1;
  }

  if (expired > 0) await db.ref().update(updates);
  return { expired };
});
