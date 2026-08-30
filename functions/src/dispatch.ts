import { db } from "./lib/db";
import { ServerValue } from "firebase-admin/database";

const increment = (by: number) => ServerValue.increment(by);
import { distanceKm, radiusBounds, round1 } from "./lib/geo";
import type { LatLng } from "./lib/validate";
import { VEHICLES, type VehicleType } from "./lib/catalog";
import { tripEventUpdate } from "./lib/events";
import { readAllDriverStats, ratingOf, acceptRateOf, type DriverStats } from "./lib/stats";
import {
  DRIVER_STALE_AFTER_MS, OFFER_TTL_MS, MAX_OFFER_ROUNDS,
  DISPATCH_RADIUS_KM, FALLBACK_SPEED_KMH,
} from "./lib/constants";

interface DriverRecord {
  lat: number;
  lng: number;
  geohash: string;
  vehicleType: VehicleType;
  status?: string;
  lastUpdated?: number;
  coldChain?: boolean;
}

export interface Candidate {
  driverId: string;
  pickupDistanceKm: number;
  etaMin: number;
  score: number;
}

/**
 * Ranks nearby drivers instead of broadcasting the job to all of them. Lower
 * score is better. Distance dominates because it is what the rider actually
 * waits on; rating and accept-rate only break ties between drivers who are
 * roughly equally close.
 */
export function scoreCandidate(stats: DriverStats | undefined, pickupDistance: number): number {
  const etaMin = (pickupDistance / FALLBACK_SPEED_KMH) * 60;
  return etaMin + (5 - ratingOf(stats)) * 2 + (1 - acceptRateOf(stats)) * 3;
}

export async function rankCandidates(options: {
  pickup: LatLng;
  vehicleType: VehicleType;
  requiresColdChain: boolean;
  exclude?: string[];
}): Promise<Candidate[]> {
  const { pickup, vehicleType, requiresColdChain } = options;
  const exclude = new Set(options.exclude ?? []);
  const now = Date.now();

  const snaps = await Promise.all(
    radiusBounds(pickup, DISPATCH_RADIUS_KM).map((b) =>
      db.ref("drivers").orderByChild("geohash").startAt(b[0]).endAt(b[1]).get()
    )
  );

  const seen = new Map<string, DriverRecord>();
  snaps.forEach((snap) => {
    const val = (snap.val() || {}) as Record<string, DriverRecord>;
    Object.entries(val).forEach(([id, d]) => seen.set(id, d));
  });

  const stats = await readAllDriverStats();

  const candidates: Candidate[] = [];
  seen.forEach((driver, driverId) => {
    if (exclude.has(driverId)) return;
    if (driver.status !== "online") return;
    if (stats[driverId]?.activeTripId) return;
    if (driver.vehicleType !== vehicleType) return;
    if (requiresColdChain && !driver.coldChain) return;
    if (typeof driver.lastUpdated !== "number" || now - driver.lastUpdated > DRIVER_STALE_AFTER_MS) return;

    const pickupDistanceKm = distanceKm({ lat: driver.lat, lng: driver.lng }, pickup);
    if (pickupDistanceKm > DISPATCH_RADIUS_KM) return;

    candidates.push({
      driverId,
      pickupDistanceKm: round1(pickupDistanceKm),
      etaMin: Math.max(1, Math.round((pickupDistanceKm / FALLBACK_SPEED_KMH) * 60)),
      score: scoreCandidate(stats[driverId], pickupDistanceKm),
    });
  });

  return candidates.sort((a, b) => a.score - b.score);
}

interface TripForDispatch {
  tripType: "person" | "goods";
  vehicleType: VehicleType;
  pickup: LatLng;
  destination: LatLng;
  handling: string;
  serviceClass: string;
  distanceKm: number;
  price: number;
  goodsDescription?: string;
  declinedBy?: Record<string, boolean>;
  offerRound?: number;
  offeredTo?: string | null;
  areaKey: string;
}

/**
 * Builds the updates that hand a trip to exactly one driver for OFFER_TTL_MS.
 * Returns null when nobody is left to ask.
 */
export async function buildOfferUpdates(
  tripId: string,
  trip: TripForDispatch
): Promise<Record<string, unknown> | null> {
  const round = (trip.offerRound ?? 0) + 1;
  const declined = Object.keys(trip.declinedBy ?? {});
  const exclude = trip.offeredTo ? [...declined, trip.offeredTo] : declined;

  if (round > MAX_OFFER_ROUNDS) return null;

  const candidates = await rankCandidates({
    pickup: trip.pickup,
    vehicleType: trip.vehicleType,
    requiresColdChain: trip.handling !== "ambient",
    exclude,
  });

  const next = candidates[0];
  if (!next) return null;

  const now = Date.now();
  const expiresAt = now + OFFER_TTL_MS;

  const updates: Record<string, unknown> = {
    [`trips/${tripId}/offeredTo`]: next.driverId,
    [`trips/${tripId}/offerExpiresAt`]: expiresAt,
    [`trips/${tripId}/offerRound`]: round,
    [`trips/${tripId}/etaToPickupMin`]: next.etaMin,
    // The offer is private to this one driver. No other driver can see the job.
    // Counting every offer is what makes acceptRate meaningful later.
    [`driverStats/${next.driverId}/offersReceived`]: increment(1),
    [`driverOffers/${next.driverId}/${tripId}`]: {
      tripId,
      tripType: trip.tripType,
      vehicleType: trip.vehicleType,
      serviceClass: trip.serviceClass,
      handling: trip.handling,
      pickup: trip.pickup,
      pickupDistanceKm: next.pickupDistanceKm,
      etaMin: next.etaMin,
      distanceKm: trip.distanceKm,
      price: trip.price,
      expiresAt,
      ...(trip.goodsDescription ? { goodsDescription: trip.goodsDescription } : {}),
    },
  };

  if (trip.offeredTo) {
    updates[`driverOffers/${trip.offeredTo}/${tripId}`] = null;
  }

  Object.assign(
    updates,
    tripEventUpdate(tripId, {
      type: "offered",
      at: now,
      actorId: next.driverId,
      data: { round, pickupDistanceKm: next.pickupDistanceKm, etaMin: next.etaMin },
    })
  );

  return updates;
}

/** Clears a trip out of the offer and demand indexes once it is settled. */
export function clearDispatchUpdates(
  tripId: string,
  trip: { offeredTo?: string | null }
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    [`openDemand/${tripId}`]: null,
    [`trips/${tripId}/offeredTo`]: null,
    [`trips/${tripId}/offerExpiresAt`]: null,
  };
  if (trip.offeredTo) {
    updates[`driverOffers/${trip.offeredTo}/${tripId}`] = null;
  }
  return updates;
}

export function vehicleColdChainCapable(vehicleType: VehicleType): boolean {
  return VEHICLES[vehicleType].carries !== "people";
}
