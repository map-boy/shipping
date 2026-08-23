import { ref, onValue, query, orderByChild, startAt, endAt } from "firebase/database";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { db, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import type { VehicleType } from "./drivers";

export type TripType = "person" | "goods";
export type TripStatus = "requested" | "accepted" | "in_progress" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "successful" | "failed" | "cash";

export interface TripRequest {
  id: string;
  riderId: string;
  tripType: TripType;
  vehicleType: VehicleType;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  pickupGeohash: string;
  distanceKm: number;
  price: number;
  status: TripStatus;
  driverId: string | null;
  createdAt: number;
  expiresAt?: number;
  acceptedAt?: number;
  startedAt?: number;
  goodsDescription?: string;
  paymentStatus?: PaymentStatus;
  paymentReferenceId?: string;
  paymentAmount?: number;
}

/**
 * What a driver sees on the open board. Deliberately narrower than TripRequest:
 * the rider's identity and drop-off address are not published until the job is taken.
 */
export interface OpenTrip {
  id: string;
  tripType: TripType;
  vehicleType: VehicleType;
  pickup: { lat: number; lng: number };
  pickupGeohash: string;
  distanceKm: number;
  price: number;
  createdAt: number;
  expiresAt: number;
  goodsDescription?: string;
}

function call<TReq extends object, TRes>(name: string) {
  return httpsCallable<TReq, TRes>(functions, name);
}

export async function createTripRequest(
  tripType: TripType,
  vehicleType: VehicleType,
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  goodsDescription?: string
): Promise<string> {
  const createTrip = call<object, { tripId: string; distanceKm: number; price: number }>("createTrip");
  const result = await createTrip({ tripType, vehicleType, pickup, destination, goodsDescription });
  return result.data.tripId;
}

export function listenToTrip(tripId: string, onUpdate: (trip: TripRequest | null) => void) {
  const tripRef = ref(db, `trips/${tripId}`);
  return onValue(
    tripRef,
    (snapshot) => {
      const val = snapshot.val();
      onUpdate(val ? { id: tripId, ...val } : null);
    },
    () => onUpdate(null)
  );
}

/**
 * Follows whichever trip this user is currently on, so a refresh or a fresh tab
 * drops them straight back into the live trip instead of an empty screen.
 */
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

export function listenToOpenTrips(
  center: { lat: number; lng: number },
  radiusKm: number,
  vehicleType: VehicleType,
  onUpdate: (trips: OpenTrip[]) => void
) {
  const centerTuple: [number, number] = [center.lat, center.lng];
  const bounds = geohashQueryBounds(centerTuple, radiusKm * 1000);
  const unsubscribes: Array<() => void> = [];
  // One bucket per geohash bound. Each snapshot replaces its own bucket wholesale,
  // so a trip another driver just took vanishes instead of lingering in the list.
  const buckets: Array<Map<string, OpenTrip>> = bounds.map(() => new Map());

  const emit = () => {
    const now = Date.now();
    const merged = new Map<string, OpenTrip>();
    buckets.forEach((bucket) => bucket.forEach((trip, id) => merged.set(id, trip)));
    const list = Array.from(merged.values())
      .filter((t) => t.vehicleType === vehicleType && t.expiresAt > now)
      .sort((a, b) => a.createdAt - b.createdAt);
    onUpdate(list);
  };

  bounds.forEach((b, index) => {
    const q = query(ref(db, "openTrips"), orderByChild("pickupGeohash"), startAt(b[0]), endAt(b[1]));
    const unsub = onValue(q, (snapshot) => {
      const data = (snapshot.val() || {}) as Record<string, Omit<OpenTrip, "id">>;
      const bucket = new Map<string, OpenTrip>();
      Object.entries(data).forEach(([id, val]) => {
        if (distanceBetween([val.pickup.lat, val.pickup.lng], centerTuple) <= radiusKm) {
          bucket.set(id, { id, ...val });
        }
      });
      buckets[index] = bucket;
      emit();
    });
    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach((u) => u());
}

export async function acceptTrip(tripId: string): Promise<void> {
  await call<{ tripId: string }, { ok: true; tripId: string }>("acceptTrip")({ tripId });
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
  await call<{ tripId: string }, { ok: true; completedAt: number }>("completeTrip")({ tripId });
}
