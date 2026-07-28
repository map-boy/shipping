import { ref, push, onValue, update, set, runTransaction, query, orderByChild, startAt, endAt } from "firebase/database";
import { geohashForLocation, geohashQueryBounds, distanceBetween } from "geofire-common";
import { db } from "../firebase";
import type { VehicleType } from "./drivers";
import { estimateFare } from "./fare";

export type TripType = "person" | "goods";
export type TripStatus = "requested" | "accepted" | "in_progress" | "completed" | "cancelled";

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
  goodsDescription?: string;
  paymentStatus?: string;
  paymentReferenceId?: string;
}

export async function createTripRequest(
  riderId: string,
  tripType: TripType,
  vehicleType: VehicleType,
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  goodsDescription?: string
) {
  const { distanceKm, price } = estimateFare(pickup, destination, vehicleType);
  const pickupGeohash = geohashForLocation([pickup.lat, pickup.lng]);

  const tripsRef = ref(db, "trips");
  const newTripRef = push(tripsRef);
  const trip: Omit<TripRequest, "id"> = {
    riderId,
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
  };
  await set(newTripRef, trip);
  return newTripRef.key as string;
}

export function listenToTrip(tripId: string, onUpdate: (trip: TripRequest | null) => void) {
  const tripRef = ref(db, `trips/${tripId}`);
  return onValue(tripRef, (snapshot) => {
    const val = snapshot.val();
    onUpdate(val ? { id: tripId, ...val } : null);
  });
}

export function listenToOpenTrips(
  center: { lat: number; lng: number },
  radiusKm: number,
  vehicleType: VehicleType,
  onUpdate: (trips: TripRequest[]) => void
) {
  const centerTuple: [number, number] = [center.lat, center.lng];
  const radiusInM = radiusKm * 1000;
  const bounds = geohashQueryBounds(centerTuple, radiusInM);
  const unsubscribes: Array<() => void> = [];
  const tripsById = new Map<string, TripRequest>();

  const emit = () => {
    const list = Array.from(tripsById.values()).filter(
      (t) => t.status === "requested" && t.vehicleType === vehicleType
    );
    onUpdate(list);
  };

  bounds.forEach((b) => {
    const q = query(ref(db, "trips"), orderByChild("pickupGeohash"), startAt(b[0]), endAt(b[1]));
    const unsub = onValue(q, (snapshot) => {
      const data = snapshot.val() || {};
      Object.entries(data).forEach(([id, val]: [string, any]) => {
        const distanceInKm = distanceBetween([val.pickup.lat, val.pickup.lng], centerTuple);
        if (distanceInKm <= radiusKm) {
          tripsById.set(id, { id, ...val });
        } else {
          tripsById.delete(id);
        }
      });
      emit();
    });
    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach((u) => u());
}

export async function acceptTrip(tripId: string, driverId: string): Promise<boolean> {
  const tripRef = ref(db, `trips/${tripId}`);

  try {
    const result = await runTransaction(tripRef, (current) => {
      if (current === null) {
        console.log("[acceptTrip] node is null, aborting");
        return current;
      }
      console.log("[acceptTrip] current status:", current.status, "driverId:", current.driverId, "trying driverId:", driverId);
      if (current.status !== "requested") {
        console.log("[acceptTrip] not requested anymore, aborting");
        return undefined;
      }
      current.status = "accepted";
      current.driverId = driverId;
      return current;
    });

    console.log("[acceptTrip] committed:", result.committed, "final value:", result.snapshot.val());
    return result.committed;
  } catch (err) {
    console.error("[acceptTrip] transaction threw:", err);
    throw err;
  }
}

export async function updateTripStatus(tripId: string, status: TripStatus) {
  await update(ref(db, `trips/${tripId}`), { status });
}