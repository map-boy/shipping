import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./lib/db";
import { requireAuth, requireString, requireLatLng } from "./lib/validate";
import { areaKey, distanceKm, geohash } from "./lib/geo";
import {
  parseVehicleType, parseServiceClass, parseHandling, assertServiceable,
} from "./lib/catalog";
import { computeFare } from "./pricing";
import { refreshMarket } from "./marketplace";
import { buildOfferUpdates, clearDispatchUpdates } from "./dispatch";
import { tripEventUpdate } from "./lib/events";
import { REQUEST_TTL_MS } from "./lib/constants";

async function assertNotBanned(uid: string) {
  const banned = await db.ref(`bannedUsers/${uid}`).get();
  if (banned.exists()) {
    throw new HttpsError("permission-denied", "Your account has been suspended.");
  }
}

async function getTrip(tripId: string) {
  const snap = await db.ref(`trips/${tripId}`).get();
  if (!snap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  return snap.val();
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export const createTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  await assertNotBanned(uid);

  const data = request.data ?? {};
  const tripType = data.tripType === "goods" ? "goods" : data.tripType === "person" ? "person" : null;
  if (!tripType) {
    throw new HttpsError("invalid-argument", "tripType must be 'person' or 'goods'.");
  }

  const vehicleType = parseVehicleType(data.vehicleType);
  const serviceClass = parseServiceClass(data.serviceClass, tripType === "person" ? "express" : "first");
  const handling = parseHandling(data.handling);
  const pickup = requireLatLng(data.pickup, "pickup");
  const destination = requireLatLng(data.destination, "destination");

  assertServiceable(vehicleType, tripType, handling);

  if (data.goodsDescription !== undefined && typeof data.goodsDescription !== "string") {
    throw new HttpsError("invalid-argument", "goodsDescription must be a string.");
  }

  const straightKm = distanceKm(pickup, destination);
  if (straightKm > 500) {
    throw new HttpsError("invalid-argument", "That trip is too long to book here.");
  }
  const routeKm = data.routeDistanceKm;
  const km =
    typeof routeKm === "number" && Number.isFinite(routeKm) && routeKm >= straightKm * 0.9
      ? routeKm
      : straightKm;
  const routeMin = data.routeDurationMin;
  const durationMin =
    typeof routeMin === "number" && Number.isFinite(routeMin) && routeMin > 0 ? routeMin : undefined;

  // Surge is read here, on the server, at the moment of booking. A pricing
  // outage falls back to no surge rather than blocking the booking.
  let surgeMultiplier = 1;
  try {
    surgeMultiplier = (await refreshMarket(pickup)).surgeMultiplier;
  } catch (err) {
    console.error("surge lookup failed during createTrip, booking at base fare:", err);
  }

  const fare = computeFare({
    distanceKm: km, durationMin, vehicleType, serviceClass, handling, surgeMultiplier,
  });

  const createdAt = Date.now();
  const description =
    typeof data.goodsDescription === "string" ? data.goodsDescription.slice(0, 280) : undefined;
  const area = areaKey(pickup);

  const tripId = db.ref("trips").push().key as string;

  const trip = {
    riderId: uid,
    tripType,
    vehicleType,
    serviceClass,
    handling,
    pickup,
    destination,
    pickupGeohash: geohash(pickup),
    areaKey: area,
    distanceKm: fare.distanceKm,
    durationMin: fare.durationMin,
    price: fare.price,
    fare,
    status: "requested",
    driverId: null,
    offeredTo: null,
    offerRound: 0,
    createdAt,
    promisedFrom: fare.promisedFrom,
    promisedBy: fare.promisedBy,
    expiresAt: createdAt + REQUEST_TTL_MS,
    ...(description ? { goodsDescription: description } : {}),
  };

  const updates: Record<string, unknown> = {
    [`trips/${tripId}`]: trip,
    [`activeTrips/${uid}`]: tripId,
    // openDemand is the demand side of the marketplace: a count, not a job board.
    [`openDemand/${tripId}`]: {
      areaKey: area,
      vehicleType,
      serviceClass,
      createdAt,
    },
  };

  Object.assign(
    updates,
    tripEventUpdate(tripId, {
      type: "requested",
      at: createdAt,
      actorId: uid,
      data: { vehicleType, serviceClass, handling, price: fare.price, surgeMultiplier },
    })
  );

  await db.ref().update(updates);

  // Express work is dispatched now. Scheduled classes are picked up by the
  // dispatch sweep closer to their window, so they do not tie up a driver today.
  let offered = false;
  if (serviceClass === "express") {
    const offer = await buildOfferUpdates(tripId, { ...trip, handling, serviceClass } as never);
    if (offer) {
      await db.ref().update(offer);
      offered = true;
    } else {
      await db.ref().update(
        tripEventUpdate(tripId, { type: "no_drivers", at: Date.now(), data: { round: 1 } })
      );
    }
  }

  return { tripId, ...fare, offered };
});

// ---------------------------------------------------------------------------
// offer lifecycle
// ---------------------------------------------------------------------------

export const acceptTrip = onCall(async (request) => {
  const uid = requireAuth(request);
  await assertNotBanned(uid);
  const tripId = requireString(request.data?.tripId, "tripId");

  const driverSnap = await db.ref(`drivers/${uid}`).get();
  if (driverSnap.val()?.activeTripId) {
    throw new HttpsError("failed-precondition", "Finish your current trip before accepting another.");
  }

  const now = Date.now();

  // Atomic compare-and-set. Even with targeted offers, two requests can land at
  // once (a retry, or a stale offer racing the next round) - only one can win.
  const claim = await db.ref(`trips/${tripId}`).transaction((current) => {
    if (current === null) return current;
    if (current.status !== "requested") return undefined;
    if (current.riderId === uid) return undefined;
    // The offer is exclusive: a driver who was not offered this trip cannot take it.
    if (current.offeredTo !== uid) return undefined;
    if (typeof current.offerExpiresAt === "number" && current.offerExpiresAt < now) return undefined;

    current.status = "accepted";
    current.driverId = uid;
    current.acceptedAt = now;
    current.offeredTo = null;
    current.offerExpiresAt = null;
    return current;
  });

  if (!claim.committed || !claim.snapshot.exists()) {
    throw new HttpsError("aborted", "That offer is no longer available.");
  }

  const trip = claim.snapshot.val();
  const updates: Record<string, unknown> = {
    [`driverOffers/${uid}/${tripId}`]: null,
    [`openDemand/${tripId}`]: null,
    [`activeTrips/${uid}`]: tripId,
    [`drivers/${uid}/activeTripId`]: tripId,
  };
  Object.assign(updates, tripEventUpdate(tripId, { type: "accepted", at: now, actorId: uid }));

  await db.ref().update(updates);
  return { ok: true, tripId, trip };
});

export const declineOffer = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.offeredTo !== uid) {
    throw new HttpsError("failed-precondition", "That offer is not yours.");
  }

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/declinedBy/${uid}`]: true,
    ...tripEventUpdate(tripId, { type: "offer_declined", at: now, actorId: uid }),
  });

  const refreshed = await getTrip(tripId);
  const next = await buildOfferUpdates(tripId, refreshed);
  if (next) {
    await db.ref().update(next);
    return { ok: true, reoffered: true };
  }

  await db.ref().update({
    [`driverOffers/${uid}/${tripId}`]: null,
    [`trips/${tripId}/offeredTo`]: null,
    [`trips/${tripId}/offerExpiresAt`]: null,
    ...tripEventUpdate(tripId, { type: "no_drivers", at: Date.now() }),
  });
  return { ok: true, reoffered: false };
});

/**
 * Advances a stalled offer to the next ranked driver. Idempotent and safe for
 * either party to call: the server re-checks that the offer has genuinely
 * expired, so calling it early does nothing.
 */
export const dispatchTick = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.riderId !== uid && trip.driverId !== uid && trip.offeredTo !== uid) {
    throw new HttpsError("permission-denied", "You are not part of this trip.");
  }
  if (trip.status !== "requested") {
    return { ok: true, advanced: false, reason: "not-waiting" };
  }

  const now = Date.now();
  if (typeof trip.offerExpiresAt === "number" && trip.offerExpiresAt > now) {
    return { ok: true, advanced: false, reason: "offer-still-live" };
  }
  if (typeof trip.expiresAt === "number" && trip.expiresAt < now) {
    return { ok: true, advanced: false, reason: "request-expired" };
  }

  if (trip.offeredTo) {
    await db.ref().update(
      tripEventUpdate(tripId, { type: "offer_expired", at: now, actorId: trip.offeredTo })
    );
  }

  const next = await buildOfferUpdates(tripId, trip);
  if (!next) {
    await db.ref().update({
      ...clearDispatchUpdates(tripId, trip),
      [`openDemand/${tripId}`]: trip.openDemand ?? null,
      ...tripEventUpdate(tripId, { type: "no_drivers", at: now }),
    });
    return { ok: true, advanced: false, reason: "no-candidates" };
  }

  await db.ref().update(next);
  return { ok: true, advanced: true };
});

// ---------------------------------------------------------------------------
// in-trip milestones
// ---------------------------------------------------------------------------

export const arriveAtPickup = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can do this.");
  }
  if (trip.status !== "accepted") {
    throw new HttpsError("failed-precondition", "Trip must be accepted first.");
  }

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/arrivedAt`]: now,
    ...tripEventUpdate(tripId, { type: "arrived", at: now, actorId: uid }),
  });
  return { ok: true };
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

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/status`]: "in_progress",
    [`trips/${tripId}/startedAt`]: now,
    ...tripEventUpdate(tripId, { type: "started", at: now, actorId: uid }),
  });
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
    throw new HttpsError("failed-precondition", "A trip already under way cannot be cancelled here.");
  }
  if (trip.paymentStatus === "successful") {
    throw new HttpsError("failed-precondition", "This trip is already paid for.");
  }

  const now = Date.now();

  if (isDriver) {
    // The driver drops it; the job is re-ranked and offered to someone else.
    const released = {
      ...trip,
      status: "requested",
      driverId: null,
      acceptedAt: null,
      arrivedAt: null,
      declinedBy: { ...(trip.declinedBy ?? {}), [uid]: true },
    };
    await db.ref().update({
      [`trips/${tripId}`]: released,
      [`drivers/${uid}/activeTripId`]: null,
      [`activeTrips/${uid}`]: null,
      [`openDemand/${tripId}`]: { areaKey: trip.areaKey, vehicleType: trip.vehicleType, serviceClass: trip.serviceClass, createdAt: trip.createdAt },
      ...tripEventUpdate(tripId, { type: "cancelled", at: now, actorId: uid, data: { by: "driver", requeued: true } }),
    });

    const next = await buildOfferUpdates(tripId, released);
    if (next) await db.ref().update(next);
    return { ok: true, requeued: true };
  }

  const record = { ...trip, status: "cancelled", cancelledAt: now, cancelledBy: "rider", completedAt: now };
  const updates: Record<string, unknown> = {
    [`trips/${tripId}`]: null,
    [`tripHistory/${trip.riderId}/${tripId}`]: record,
    [`activeTrips/${trip.riderId}`]: null,
    ...clearDispatchUpdates(tripId, trip),
    ...tripEventUpdate(tripId, { type: "cancelled", at: now, actorId: uid, data: { by: "rider" } }),
  };
  if (trip.driverId) {
    updates[`tripHistory/${trip.driverId}/${tripId}`] = record;
    updates[`activeTrips/${trip.driverId}`] = null;
    updates[`drivers/${trip.driverId}/activeTripId`] = null;
  }

  await db.ref().update(updates);
  return { ok: true, requeued: false };
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

  const now = Date.now();
  const paid = trip.paymentStatus === "successful" || trip.paymentStatus === "cash";

  // A payment outage must not trap a driver in a finished trip. The delivery is
  // recorded as done either way and the debt is carried on the record instead.
  const settlement = paid ? trip.paymentStatus : "outstanding";
  const record = {
    ...trip,
    status: "completed",
    completedAt: now,
    paymentStatus: settlement,
    settled: paid,
    onTime: typeof trip.promisedBy === "number" ? now <= trip.promisedBy : null,
  };

  await db.ref().update({
    [`trips/${tripId}`]: null,
    [`tripHistory/${trip.riderId}/${tripId}`]: record,
    [`tripHistory/${uid}/${tripId}`]: record,
    [`activeTrips/${trip.riderId}`]: null,
    [`activeTrips/${uid}`]: null,
    [`drivers/${uid}/activeTripId`]: null,
    ...clearDispatchUpdates(tripId, trip),
    ...tripEventUpdate(tripId, {
      type: "completed",
      at: now,
      actorId: uid,
      data: { settled: paid, paymentStatus: settlement, onTime: record.onTime },
    }),
  });

  return { ok: true, completedAt: now, settled: paid };
});
