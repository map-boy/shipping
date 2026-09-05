import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import type { VehicleType } from "./catalog";

export interface SingleDriverLocation {
  lat: number;
  lng: number;
  vehicleType: VehicleType;
  lastUpdated: number;
}

/**
 * Follows one driver's live position. The rider is allowed to read `drivers` while
 * signed in, so a failure here is almost always an auth or rules problem rather
 * than an absent driver - the two are reported separately so the UI can say which.
 */
export function listenToDriverLocation(
  driverId: string,
  onUpdate: (loc: SingleDriverLocation | null) => void,
  onError?: (error: Error) => void
) {
  return onValue(
    ref(db, `drivers/${driverId}`),
    (snapshot) => {
      const val = snapshot.val();
      if (!val || typeof val.lat !== "number" || typeof val.lng !== "number") {
        onUpdate(null);
        return;
      }
      onUpdate({
        lat: val.lat,
        lng: val.lng,
        vehicleType: (val.vehicleType as VehicleType) ?? "standard",
        lastUpdated: typeof val.lastUpdated === "number" ? val.lastUpdated : 0,
      });
    },
    (error) => {
      console.error("[trackDriver] cannot read driver location:", error);
      onUpdate(null);
      onError?.(error);
    }
  );
}
