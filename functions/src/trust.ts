import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./lib/db";
import { requireAuth, requireString } from "./lib/validate";
import { recordTripEvent } from "./lib/events";

/**
 * Ratings and proof of delivery. The dispatcher already ranks on rating and
 * accept rate; this is what actually puts numbers behind them.
 */

export const rateTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const score = Number(request.data?.score);
  const comment = typeof request.data?.comment === "string" ? request.data.comment.slice(0, 280) : "";

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new HttpsError("invalid-argument", "score must be a whole number from 1 to 5.");
  }

  // Only a finished trip can be rated, and only by someone who was on it.
  const snap = await db.ref(`tripHistory/${uid}/${tripId}`).get();
  if (!snap.exists()) {
    throw new HttpsError("not-found", "No completed trip of yours with that id.");
  }
  const trip = snap.val();
  if (trip.status !== "completed") {
    throw new HttpsError("failed-precondition", "Only completed trips can be rated.");
  }

  const isRider = trip.riderId === uid;
  const subjectId = isRider ? trip.driverId : trip.riderId;
  if (!subjectId) {
    throw new HttpsError("failed-precondition", "That trip has no counterparty to rate.");
  }

  const existing = await db.ref(`ratings/${tripId}/${uid}`).get();
  if (existing.exists()) {
    throw new HttpsError("already-exists", "You have already rated this trip.");
  }

  await db.ref(`ratings/${tripId}/${uid}`).set({
    by: uid,
    subject: subjectId,
    score,
    comment,
    at: Date.now(),
  });

  // Only rider-on-driver scores feed the dispatch ranking.
  if (isRider) {
    await db.ref(`driverStats/${subjectId}`).transaction((current) => {
      const stats = current ?? {};
      const count = (stats.ratingCount ?? 0) + 1;
      const total = (stats.ratingTotal ?? 0) + score;
      return { ...stats, ratingCount: count, ratingTotal: total, rating: Math.round((total / count) * 100) / 100 };
    });
  }

  await recordTripEvent(tripId, {
    type: "completed",
    at: Date.now(),
    actorId: uid,
    data: { rated: score },
  });

  return { ok: true };
});

/**
 * Proof of delivery for goods the sender is not travelling with. The rider holds
 * a code; the driver can only close the job by producing it.
 */
export const confirmDelivery = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const code = requireString(request.data?.code, "code");
  const recipientName = typeof request.data?.recipientName === "string"
    ? request.data.recipientName.slice(0, 120)
    : "";

  const snap = await db.ref(`trips/${tripId}`).get();
  if (!snap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  const trip = snap.val();

  if (trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can confirm delivery.");
  }
  if (trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "The trip must be under way.");
  }
  if (!trip.deliveryCode) {
    throw new HttpsError("failed-precondition", "This trip does not use a delivery code.");
  }
  if (String(code).trim() !== String(trip.deliveryCode)) {
    throw new HttpsError("permission-denied", "That delivery code does not match.");
  }

  const now = Date.now();
  await db.ref(`trips/${tripId}`).update({
    deliveryConfirmedAt: now,
    recipientName: recipientName || null,
  });
  await recordTripEvent(tripId, {
    type: "arrived",
    at: now,
    actorId: uid,
    data: { proofOfDelivery: true, recipientName: recipientName || null },
  });

  return { ok: true };
});
