import { ref, onValue } from "firebase/database";
import { db, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import type { Handling, ServiceClass, TripType, VehicleType, TruckPackage } from "./catalog";
export type { Handling, ServiceClass, TripType, VehicleType, TruckPackage } from "./catalog";
import type { FareQuote } from "./pricing";

export type TripStatus = "requested" | "accepted" | "in_progress" | "completed" | "cancelled" | "expired";
export type PaymentStatus = "pending" | "successful" | "failed" | "cash" | "outstanding";

export interface TripRequest {
  id: string;
  riderId: string;
  tripType: TripType;
  vehicleType: VehicleType;
  serviceClass: ServiceClass;
  handling: Handling;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  pickupGeohash: string;
  areaKey: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  fare?: FareQuote;
  status: TripStatus;
  driverId: string | null;
  offeredTo?: string | null;
  offerExpiresAt?: number | null;
  offerRound?: number;
  etaToPickupMin?: number;
  createdAt: number;
  promisedFrom?: number;
  promisedBy?: number;
  expiresAt?: number;
  acceptedAt?: number;
  arrivedAt?: number;
  startedAt?: number;
  goodsDescription?: string;
  truckPackage?: TruckPackage;
  tonnes?: number;
  contactPhone?: string;
  paymentStatus?: PaymentStatus;
  paymentReferenceId?: string;
  paymentAmount?: number;
  deliveryCode?: string;
  deliveryConfirmedAt?: number;
  recipientName?: string | null;
}

export interface DriverStats {
  activeTripId?: string | null;
  rating?: number;
  ratingCount?: number;
  offersReceived?: number;
  offersAccepted?: number;
  completedTrips?: number;
  onTimeTrips?: number;
}

/** A job offered privately to one driver. Never visible to any other driver. */
export interface DriverOffer {
  tripId: string;
  tripType: TripType;
  vehicleType: VehicleType;
  serviceClass: ServiceClass;
  handling: Handling;
  pickup: { lat: number; lng: number };
  pickupDistanceKm: number;
  etaMin: number;
  distanceKm: number;
  price: number;
  expiresAt: number;
  goodsDescription?: string;
}

function call<TReq extends object, TRes>(name: string) {
  return httpsCallable<TReq, TRes>(functions, name);
}

export interface CreateTripInput {
  tripType: TripType;
  vehicleType: VehicleType;
  serviceClass: ServiceClass;
  handling: Handling;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  goodsDescription?: string;
  truckPackage?: TruckPackage;
  tonnes?: number;
  contactPhone?: string;
  routeDistanceKm?: number;
  routeDurationMin?: number;
}

export async function createTripRequest(input: CreateTripInput): Promise<string> {
  const result = await call<CreateTripInput, { tripId: string; price: number; offered: boolean }>(
    "createTrip"
  )(input);
  return result.data.tripId;
}

export function listenToTrip(tripId: string, onUpdate: (trip: TripRequest | null) => void) {
  return onValue(
    ref(db, `trips/${tripId}`),
    (snapshot) => {
      const val = snapshot.val();
      onUpdate(val ? { id: tripId, ...val } : null);
    },
    () => onUpdate(null)
  );
}

/** Reconnects either party to the trip they are on after a refresh or a new tab. */
export function listenToActiveTrip(uid: string, onUpdate: (trip: TripRequest | null) => void) {
  let unsubTrip: (() => void) | null = null;

  const unsubPointer = onValue(
    ref(db, `activeTrips/${uid}`),
    (snapshot) => {
      const tripId = snapshot.val() as string | null;
      unsubTrip?.();
      unsubTrip = null;
      if (!tripId) {
        onUpdate(null);
        return;
      }
      unsubTrip = listenToTrip(tripId, onUpdate);
    },
    () => onUpdate(null)
  );

  return () => {
    unsubPointer();
    unsubTrip?.();
  };
}

/**
 * A driver watches only their own offers. There is no shared job board to read,
 * so no driver can see work that was not ranked to them.
 */
export function listenToMyOffers(driverId: string, onUpdate: (offers: DriverOffer[]) => void) {
  const unsub = onValue(
    ref(db, `driverOffers/${driverId}`),
    (snapshot) => {
      const data = (snapshot.val() || {}) as Record<string, DriverOffer>;
      const now = Date.now();
      onUpdate(Object.values(data).filter((o) => o.expiresAt > now));
    },
    () => onUpdate([])
  );

  // Offers lapse on a clock, not on a write, so re-filter as they age out.
  const timer = setInterval(() => {
    onValue(
      ref(db, `driverOffers/${driverId}`),
      (snapshot) => {
        const data = (snapshot.val() || {}) as Record<string, DriverOffer>;
        const now = Date.now();
        onUpdate(Object.values(data).filter((o) => o.expiresAt > now));
      },
      { onlyOnce: true }
    );
  }, 5000);

  return () => {
    clearInterval(timer);
    unsub();
  };
}

export async function acceptTrip(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true }>("acceptTrip")({ tripId });
}

export async function declineOffer(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true; reoffered: boolean }>("declineOffer")({ tripId });
}

/** Nudges a stalled offer on to the next driver. Safe to call repeatedly. */
export async function dispatchTick(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true; advanced: boolean }>("dispatchTick")({ tripId });
}

export async function arriveAtPickup(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true }>("arriveAtPickup")({ tripId });
}

export async function startTrip(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true }>("startTrip")({ tripId });
}

export async function cancelTrip(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true; requeued: boolean }>("cancelTrip")({ tripId });
}

export async function markCashPayment(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true }>("markCashPayment")({ tripId });
}

export async function completeTrip(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true; settled: boolean }>("completeTrip")({ tripId });
}

/** Driver produces the recipient's code before a goods job can be closed. */
export async function confirmDelivery(
  tripId: string,
  code: string,
  recipientName?: string
): Promise<void> {
  await call<{ tripId: string; code: string; recipientName?: string }, { ok: true }>(
    "confirmDelivery"
  )({ tripId, code, recipientName });
}

export async function rateTrip(tripId: string, score: number, comment?: string): Promise<void> {
  await call<{ tripId: string; score: number; comment?: string }, { ok: true }>("rateTrip")({
    tripId,
    score,
    comment,
  });
}

export function listenToDriverStats(driverId: string, onUpdate: (stats: DriverStats) => void) {
  return onValue(
    ref(db, `driverStats/${driverId}`),
    (snapshot) => onUpdate((snapshot.val() || {}) as DriverStats),
    () => onUpdate({})
  );
}