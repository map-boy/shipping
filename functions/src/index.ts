import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

initializeApp();
const db = getDatabase();

const MOMO_ENV = process.env.MOMO_ENV || "sandbox";
const MOMO_BASE_URL = MOMO_ENV === "production"
  ? "https://proxy.momoapi.mtn.com"
  : "https://sandbox.momodeveloper.mtn.com";

async function getMomoToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.MOMO_API_USER}:${process.env.MOMO_API_KEY}`).toString("base64");
  try {
    const res = await axios.post(
      `${MOMO_BASE_URL}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
        },
      }
    );
    return res.data.access_token;
  } catch (err: any) {
    console.error("MoMo token error:", err.response?.data || err.message);
    throw new HttpsError("internal", "Could not authenticate with Mobile Money.");
  }
}

export const requestMomoPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { phoneNumber, tripId } = request.data;
  if (!phoneNumber || !tripId) {
    throw new HttpsError("invalid-argument", "phoneNumber and tripId are required.");
  }

  const tripSnap = await db.ref(`trips/${tripId}`).get();
  if (!tripSnap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  const trip = tripSnap.val();

  if (trip.riderId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "You do not own this trip.");
  }
  if (trip.paymentStatus === "pending" || trip.paymentStatus === "successful") {
    throw new HttpsError("failed-precondition", "Payment already requested or completed for this trip.");
  }
  const amount = trip.price;
  if (!amount || typeof amount !== "number" || amount <= 0) {
    throw new HttpsError("failed-precondition", "Trip has no valid price set.");
  }

  const referenceId = uuidv4();
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
  } catch (err: any) {
    console.error("MoMo requesttopay error:", err.response?.data || err.message);
    const reason = err.response?.data?.message || "Mobile Money rejected the payment request.";
    throw new HttpsError("internal", reason);
  }

  await db.ref(`trips/${tripId}/paymentStatus`).set("pending");
  await db.ref(`trips/${tripId}/paymentReferenceId`).set(referenceId);
  await db.ref(`trips/${tripId}/paymentAmount`).set(amount);
  await db.ref(`trips/${tripId}/paymentCreatedAt`).set(Date.now());

  return { referenceId };
});

export const checkMomoPaymentStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { referenceId, tripId } = request.data;
  if (!referenceId || !tripId) {
    throw new HttpsError("invalid-argument", "referenceId and tripId are required.");
  }

  const token = await getMomoToken();

  let status: string;
  try {
    const res = await axios.get(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": MOMO_ENV,
        "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
      },
    });
    status = res.data.status.toLowerCase();
  } catch (err: any) {
    console.error("MoMo status check error:", err.response?.data || err.message);
    throw new HttpsError("internal", "Could not check payment status.");
  }

  await db.ref(`trips/${tripId}/paymentStatus`).set(status);

  return { status };
});
export const markCashPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { tripId } = request.data;
  if (!tripId) {
    throw new HttpsError("invalid-argument", "tripId is required.");
  }

  const tripSnap = await db.ref(`trips/${tripId}`).get();
  if (!tripSnap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  const trip = tripSnap.val();

  if (trip.driverId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can do this.");
  }
  if (trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Trip must be in progress to mark cash payment.");
  }
  if (trip.paymentStatus === "successful") {
    throw new HttpsError("failed-precondition", "This trip was already paid via Mobile Money.");
  }

  await db.ref(`trips/${tripId}/paymentStatus`).set("cash");
  return { ok: true };
});

export const completeTrip = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { tripId } = request.data;
  if (!tripId) {
    throw new HttpsError("invalid-argument", "tripId is required.");
  }

  const tripSnap = await db.ref(`trips/${tripId}`).get();
  if (!tripSnap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  const trip = tripSnap.val();

  if (trip.driverId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can complete this trip.");
  }
  if (trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Trip must be in progress to complete.");
  }
  if (trip.paymentStatus !== "successful" && trip.paymentStatus !== "cash") {
    throw new HttpsError("failed-precondition", "Payment must be completed before finishing the trip.");
  }

  await db.ref(`trips/${tripId}`).remove();
  return { ok: true };
});
function checkAdminCreds(username: any, password: any) {
  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    throw new HttpsError("permission-denied", "Invalid admin credentials.");
  }
}

export const adminLogin = onCall(async (request) => {
  const { username, password } = request.data;
  checkAdminCreds(username, password);
  return { ok: true };
});

export const adminListTrips = onCall(async (request) => {
  const { username, password } = request.data;
  checkAdminCreds(username, password);
  const snap = await db.ref("trips").get();
  const val = snap.val() || {};
  const trips = Object.entries(val).map(([id, t]: [string, any]) => ({ id, ...t }));
  return { trips };
});

export const adminListDrivers = onCall(async (request) => {
  const { username, password } = request.data;
  checkAdminCreds(username, password);
  const snap = await db.ref("drivers").get();
  const val = snap.val() || {};
  const drivers = Object.entries(val).map(([id, d]: [string, any]) => ({ id, ...d }));
  return { drivers };
});

export const adminListBans = onCall(async (request) => {
  const { username, password } = request.data;
  checkAdminCreds(username, password);
  const snap = await db.ref("bannedUsers").get();
  return { bans: snap.val() || {} };
});

export const adminDeleteTrip = onCall(async (request) => {
  const { username, password, tripId } = request.data;
  checkAdminCreds(username, password);
  if (!tripId) {
    throw new HttpsError("invalid-argument", "tripId is required.");
  }
  await db.ref(`trips/${tripId}`).remove();
  return { ok: true };
});

export const adminSetUserBan = onCall(async (request) => {
  const { username, password, userId, banned, reason } = request.data;
  checkAdminCreds(username, password);
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }
  if (banned) {
    await db.ref(`bannedUsers/${userId}`).set({ bannedAt: Date.now(), reason: reason || "" });
  } else {
    await db.ref(`bannedUsers/${userId}`).remove();
  }
  return { ok: true };
});

export const adminSetDriverStatus = onCall(async (request) => {
  const { username, password, driverId, status } = request.data;
  checkAdminCreds(username, password);
  if (!driverId || !status) {
    throw new HttpsError("invalid-argument", "driverId and status are required.");
  }
  await db.ref(`drivers/${driverId}/status`).set(status);
  return { ok: true };
});
const FARE_TABLE: Record<string, { base: number; perKm: number }> = {
  standard: { base: 500, perKm: 300 },
  truck: { base: 1500, perKm: 600 },
  vip: { base: 2500, perKm: 900 },
};

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

export const createTrip = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { tripType, vehicleType, pickup, destination, goodsDescription } = request.data;

  const bannedSnap = await db.ref(`bannedUsers/${request.auth.uid}`).get();
  if (bannedSnap.exists()) {
    throw new HttpsError("permission-denied", "Your account has been suspended.");
  }

  if (!pickup || !destination || !vehicleType || !tripType) {
    throw new HttpsError("invalid-argument", "Missing required trip fields.");
  }
  if (!FARE_TABLE[vehicleType]) {
    throw new HttpsError("invalid-argument", "Unknown vehicleType.");
  }

  const distanceKmRaw = haversineKm(pickup, destination);
  const { base, perKm } = FARE_TABLE[vehicleType];
  const price = Math.round(base + distanceKmRaw * perKm);
  const distanceKm = Math.round(distanceKmRaw * 10) / 10;
  const pickupGeohash = geohashEncode(pickup.lat, pickup.lng);

  const tripRef = db.ref("trips").push();
  await tripRef.set({
    riderId: request.auth.uid,
    tripType,
    vehicleType,
    pickup,
    destination,
    pickupGeohash,
    distanceKm,
    price,
    status: "requested",
    driverId: null,
    createdAt: Date.now(),
    ...(goodsDescription ? { goodsDescription } : {}),
  });

  return { tripId: tripRef.key, distanceKm, price };
});