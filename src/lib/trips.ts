import { ref, push, onValue, update, set } from "firebase/database";
import { db } from "../firebase";
import type { VehicleType } from "./drivers";

export type TripType = "person" | "goods";
export type TripStatus = "requested" | "accepted" | "in_progress" | "completed" | "cancelled";

export interface TripRequest {
  id: string;
  riderId: string;
  tripType: TripType;
  vehicleType: VehicleType;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  status: TripStatus;
  driverId: string | null;
  createdAt: number;
  goodsDescription?: string;
}

export async function createTripRequest(
  riderId: string,
  tripType: TripType,
  vehicleType: VehicleType,
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  goodsDescription?: string
) {
  const tripsRef = ref(db, "trips");
  const newTripRef = push(tripsRef);
  const trip: Omit<TripRequest, "id"> = {
    riderId,
    tripType,
    vehicleType,
    pickup,
    destination,
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

export function listenToOpenTrips(vehicleType: VehicleType, onUpdate: (trips: TripRequest[]) => void) {
  const tripsRef = ref(db, "trips");
  return onValue(tripsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const open = Object.entries(data)
      .map(([id, val]: [string, any]) => ({ id, ...val }))
      .filter((t: TripRequest) => t.status === "requested" && t.vehicleType === vehicleType);
    onUpdate(open);
  });
}

export async function acceptTrip(tripId: string, driverId: string) {
  await update(ref(db, `trips/${tripId}`), { status: "accepted", driverId });
}

export async function updateTripStatus(tripId: string, status: TripStatus) {
  await update(ref(db, `trips/${tripId}`), { status });
}

