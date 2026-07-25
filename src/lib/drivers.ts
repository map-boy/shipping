import { ref, onValue, set, onDisconnect, update } from "firebase/database";
import { geohashForLocation, geohashQueryBounds, distanceBetween } from "geofire-common";
import { db } from "../firebase";

export type VehicleType = "standard" | "truck" | "vip";

export interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  vehicleType: VehicleType;
  status: "online" | "busy" | "offline";
  geohash: string;
}

export async function publishDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  vehicleType: VehicleType,
  status: "online" | "busy" | "offline"
) {
  const geohash = geohashForLocation([lat, lng]);
  const driverRef = ref(db, `drivers/${driverId}`);

  await set(driverRef, {
    lat,
    lng,
    vehicleType,
    status,
    geohash,
  });

  // If the driver's connection drops (tab closed, laptop dies, network lost),
  // Firebase's own servers flip them to offline automatically.
  if (status === "online") {
    await onDisconnect(driverRef).update({ status: "offline" });
  }
}

export async function goOffline(driverId: string) {
  await update(ref(db, `drivers/${driverId}`), { status: "offline" });
}

export function listenNearbyDrivers(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  vehicleType: VehicleType | "all",
  onUpdate: (drivers: DriverLocation[]) => void
) {
  const center: [number, number] = [centerLat, centerLng];
  const radiusInM = radiusKm * 1000;
  const bounds = geohashQueryBounds(center, radiusInM);

  const unsubscribes: Array<() => void> = [];
  const driversById = new Map<string, DriverLocation>();

  const emit = () => {
    const list = Array.from(driversById.values()).filter(
      (d) => d.status === "online" && (vehicleType === "all" || d.vehicleType === vehicleType)
    );
    onUpdate(list);
  };

  bounds.forEach((b) => {
    const q = ref(db, "drivers");
    const unsub = onValue(q, (snapshot) => {
      const data = snapshot.val() || {};
      Object.entries(data).forEach(([id, val]: [string, any]) => {
        if (val.geohash >= b[0] && val.geohash <= b[1]) {
          const distanceInKm = distanceBetween([val.lat, val.lng], center);
          if (distanceInKm <= radiusKm) {
            driversById.set(id, { id, ...val });
          } else {
            driversById.delete(id);
          }
        } else {
          driversById.delete(id);
        }
      });
      emit();
    });
    unsubscribes.push(unsub);
  });

  return () => unsubscribes.forEach((u) => u());
}
