import { useEffect, useRef, useState } from "react";
import { publishDriverLocation, goOffline, type VehicleType } from "../lib/drivers";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { listenToOpenTrips, listenToTrip, acceptTrip, updateTripStatus, type TripRequest } from "../lib/trips";
import { auth } from "../firebase";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "truck", label: "Truck" },
  { value: "vip", label: "VIP" },
];

export default function DriverPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authChecked, setAuthChecked] = useState(false);
  const [online, setOnline] = useState(() => localStorage.getItem("driverOnline") === "true");
  const [vehicleType, setVehicleType] = useState<VehicleType>(() => (localStorage.getItem("driverVehicleType") as VehicleType) || "standard");
  const [resuming, setResuming] = useState(true);
  const [openTrips, setOpenTrips] = useState<TripRequest[]>([]);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    get(ref(db, `drivers/${user.uid}/status`)).then((snap) => {
      const dbOnline = snap.exists() && snap.val() === "online";
      setOnline(dbOnline);
      localStorage.setItem("driverOnline", String(dbOnline));
      setResuming(false);
    }).catch(() => setResuming(false));
  }, [user]);

  useEffect(() => {
    localStorage.setItem("driverOnline", String(online));
  }, [online]);

  useEffect(() => {
    localStorage.setItem("driverVehicleType", vehicleType);
  }, [vehicleType]);

  useEffect(() => {
    if (!user) return;
    const driverId = user.uid;

    if (!online) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      goOffline(driverId);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        publishDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude, vehicleType, "online");
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [online, vehicleType, user]);

  useEffect(() => {
    if (!online || !driverPos || activeTrip) {
      setOpenTrips([]);
      return;
    }
    const unsub = listenToOpenTrips(driverPos, 15, vehicleType, setOpenTrips);
    return unsub;
  }, [vehicleType, online, driverPos, activeTrip]);

  async function handleAccept(tripId: string) {
    if (!user) return;
    setNotice(null);
    setError(null);
    const won = await acceptTrip(tripId, user.uid);
    if (!won) {
      setNotice("Too slow - another driver already accepted that trip.");
      return;
    }
    listenToTrip(tripId, (trip) => {
      setActiveTrip(trip);
      if (trip && trip.status === "completed") {
        setActiveTrip(null);
      }
    });
  }

  async function handleStartTrip() {
    if (!activeTrip) return;
    await updateTripStatus(activeTrip.id, "in_progress");
  }

  async function handleCompleteTrip() {
    if (!activeTrip) return;
    await updateTripStatus(activeTrip.id, "completed");
    setActiveTrip(null);
  }

  if (!authChecked) {
    return <div className="max-w-3xl mx-auto px-4 py-8">Checking your session...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Driver dashboard</h1>
        <p className="text-gray-600">Please log in first to go online and accept trips.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Driver dashboard</h1>

      <div className="flex items-center gap-3">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          disabled={!!activeTrip}
          className="border rounded px-3 py-2"
        >
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => setOnline((v) => !v)}
          disabled={!!activeTrip || resuming}
          className={`px-4 py-2 rounded font-medium ${online ? "bg-green-600 text-white" : "bg-gray-200"}`}
        >
          {online ? "Online" : "Go online"}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {notice && <p className="text-amber-600 text-sm">{notice}</p>}

      {activeTrip ? (
        <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
          <h2 className="font-semibold">Active trip</h2>
          <p className="text-sm font-medium">
            {activeTrip.tripType === "person" ? "Passenger" : "Goods delivery"}
          </p>
          <p className="text-sm text-gray-600">{activeTrip.distanceKm} km &middot; {activeTrip.price} RWF</p>
          {activeTrip.goodsDescription && (
            <p className="text-sm text-gray-500">{activeTrip.goodsDescription}</p>
          )}
          <p className="text-xs text-gray-500">
            Pickup: {activeTrip.pickup.lat.toFixed(4)}, {activeTrip.pickup.lng.toFixed(4)}
          </p>
          <p className="text-xs text-gray-500">
            Destination: {activeTrip.destination.lat.toFixed(4)}, {activeTrip.destination.lng.toFixed(4)}
          </p>
          <p className="text-sm font-medium">Status: {activeTrip.status}</p>

          {activeTrip.status === "accepted" && (
            <button
              onClick={handleStartTrip}
              className="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium"
            >
              Start trip
            </button>
          )}
          {activeTrip.status === "in_progress" && (
            <button
              onClick={handleCompleteTrip}
              className="w-full bg-green-600 text-white rounded py-2 text-sm font-medium"
            >
              Complete trip
            </button>
          )}
        </div>
      ) : (
        <div>
          <h2 className="font-semibold mb-2">Open requests ({vehicleType})</h2>
          {openTrips.length === 0 && <p className="text-sm text-gray-500">No requests right now.</p>}
          <ul className="space-y-2">
            {openTrips.map((trip) => (
              <li key={trip.id} className="border rounded p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{trip.tripType === "person" ? "Passenger" : "Goods delivery"}</p>
                  <p className="text-xs text-gray-600">{trip.distanceKm} km &middot; {trip.price} RWF</p>
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
      )}
    </div>
  );
}
