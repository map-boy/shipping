import { useEffect, useRef, useState } from "react";
import { publishDriverLocation, goOffline, type VehicleType } from "../lib/drivers";
import { listenToOpenTrips, acceptTrip, type TripRequest } from "../lib/trips";
import { auth } from "../firebase";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "truck", label: "Truck" },
  { value: "vip", label: "VIP" },
];

export default function DriverPage() {
  const [online, setOnline] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [openTrips, setOpenTrips] = useState<TripRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const driverId = auth.currentUser?.uid || "anonymous-driver";

    if (!online) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      goOffline(driverId);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        publishDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude, vehicleType, "online");
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [online, vehicleType]);

  useEffect(() => {
    const unsub = listenToOpenTrips(vehicleType, setOpenTrips);
    return unsub;
  }, [vehicleType]);

  async function handleAccept(tripId: string) {
    const driverId = auth.currentUser?.uid || "anonymous-driver";
    await acceptTrip(tripId, driverId);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Driver dashboard</h1>

      <div className="flex items-center gap-3">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className="border rounded px-3 py-2"
        >
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => setOnline((v) => !v)}
          className={`px-4 py-2 rounded font-medium ${online ? "bg-green-600 text-white" : "bg-gray-200"}`}
        >
          {online ? "Online" : "Go online"}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div>
        <h2 className="font-semibold mb-2">Open requests ({vehicleType})</h2>
        {openTrips.length === 0 && <p className="text-sm text-gray-500">No requests right now.</p>}
        <ul className="space-y-2">
          {openTrips.map((trip) => (
            <li key={trip.id} className="border rounded p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{trip.tripType === "person" ? "Passenger" : "Goods delivery"}</p>
                {trip.goodsDescription && <p className="text-xs text-gray-500">{trip.goodsDescription}</p>}
              </div>
              <button
                onClick={() => handleAccept(trip.id)}
                className="bg-blue-600 text-white text-sm px-3 py-1 rounded"
              >
                Accept
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
