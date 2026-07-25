import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

export interface SingleDriverLocation {
  lat: number;
  lng: number;
}

export function listenToDriverLocation(
  driverId: string,
  onUpdate: (loc: SingleDriverLocation | null) => void
) {
  const driverRef = ref(db, `drivers/${driverId}`);
  return onValue(driverRef, (snapshot) => {
    const val = snapshot.val();
    onUpdate(val ? { lat: val.lat, lng: val.lng } : null);
  });
}

