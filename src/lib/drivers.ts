import { ref, onValue, set, update, query, orderByChild, startAt, endAt } from "firebase/database";
import { geohashForLocation, geohashQueryBounds, distanceBetween } from "geofire-common";
import { db } from "../firebase";

export type { VehicleType } from "./catalog";
import type { VehicleType } from "./catalog";
export type DriverStatus = "online" | "busy" | "offline";

/**
 * A driver who has not sent a position in this long is hidden from riders. Drivers
 * stay "online" in the database until they tap "Go offline" themselves, so this is
 * what keeps a closed tab or a dead battery from showing up as a bookable car.
 */
export const DRIVER_STALE_AFTER_MS = 90_000;

export interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  vehicleType: VehicleType;
  status: DriverStatus;
  geohash: string;
  lastUpdated: number;
}

export async function publishDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  vehicleType: VehicleType,
  status: DriverStatus,
  coldChain = false
) {
  // Hot storage: the position is overwritten in place on every ping. Nothing
  // here is kept as history - trip milestones go to tripEvents instead.
  await set(ref(db, `drivers/${driverId}`), {
    lat,
    lng,
    vehicleType,
    status,
    coldChain,
    geohash: geohashForLocation([lat, lng]),
    lastUpdated: Date.now(),
  });
}

export async function goOffline(driverId: string) {
  await update(ref(db, `drivers/${driverId}`), { status: "offline", lastUpdated: Date.now() });
}

export function listenNearbyDrivers(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  vehicleType: VehicleType | "all",
  onUpdate: (drivers: DriverLocation[]) => void
) {
  const center: [number, number] = [centerLat, centerLng];
  const bounds = geohashQueryBounds(center, radiusKm * 1000);
  const unsubscribes: Array<() => void> = [];
  const buckets: Array<Map<string, DriverLocation>> = bounds.map(() => new Map());

  const emit = () => {
    const cutoff = Date.now() - DRIVER_STALE_AFTER_MS;
    const merged = new Map<string, DriverLocation>();
    buckets.forEach((bucket) => bucket.forEach((driver, id) => merged.set(id, driver)));
    onUpdate(
      Array.from(merged.values()).filter(
        (d) =>
          d.status === "online" &&
          d.lastUpdated >= cutoff &&
          (vehicleType === "all" || d.vehicleType === vehicleType)
      )
    );
  };

  bounds.forEach((b, index) => {
    const q = query(ref(db, "drivers"), orderByChild("geohash"), startAt(b[0]), endAt(b[1]));
    const unsub = onValue(q, (snapshot) => {
      const data = (snapshot.val() || {}) as Record<string, Omit<DriverLocation, "id">>;
      const bucket = new Map<string, DriverLocation>();
      Object.entries(data).forEach(([id, val]) => {
        if (distanceBetween([val.lat, val.lng], center) <= radiusKm) {
          bucket.set(id, { id, ...val });
        }
      });
      buckets[index] = bucket;
      emit();
    });
    unsubscribes.push(unsub);
  });

  // Drivers age out even when no new snapshot arrives, so re-filter on a timer.
  const staleTimer = setInterval(emit, 15_000);

  return () => {
    clearInterval(staleTimer);
    unsubscribes.forEach((u) => u());
  };
}
