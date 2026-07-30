import { useEffect, useRef, useState } from "react";
import { publishDriverLocation, goOffline, type VehicleType } from "../lib/drivers";
import DriverMap from "./DriverMap";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { listenToOpenTrips, listenToTrip, acceptTrip, updateTripStatus, markCashPayment, completeTrip, type TripRequest } from "../lib/trips";
import { auth } from "../firebase";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "truck", label: "Truck" },
  { value: "vip", label: "VIP" },
];

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.value = 880;
      gain2.gain.setValueAtTime(0.001, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.4);
    }, 450);
  } catch {
    // ignore if audio not supported
  }
}

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
  const [alertTrip, setAlertTrip] = useState<TripRequest | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const knownTripIdsRef = useRef<Set<string>>(new Set());
  const ignoredTripIdsRef = useRef<Set<string>>(new Set());

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
      knownTripIdsRef.current = new Set();
      return;
    }
    const unsub = listenToOpenTrips(driverPos, 15, vehicleType, (rawTrips) => {
      const trips = rawTrips.filter((t) => !ignoredTripIdsRef.current.has(t.id));
      const newOnes = trips.filter((t) => !knownTripIdsRef.current.has(t.id));
      if (newOnes.length > 0 && knownTripIdsRef.current.size > 0) {
        playBeep();
        setAlertTrip(newOnes[0]);
      } else if (newOnes.length > 0 && knownTripIdsRef.current.size === 0) {
        playBeep();
        setAlertTrip(newOnes[0]);
      }
      knownTripIdsRef.current = new Set(trips.map((t) => t.id));
      setOpenTrips(trips);
    });
    return unsub;
  }, [vehicleType, online, driverPos, activeTrip]);

  async function handleAccept(tripId: string) {
    if (!user) return;
    setNotice(null);
    setError(null);
    setAlertTrip(null);
    ignoredTripIdsRef.current.add(tripId);
    const won = await acceptTrip(tripId, user.uid);
    if (!won) {
      setNotice("Too slow - another driver already accepted that trip.");
      return;
    }
    listenToTrip(tripId, (trip) => {
      setActiveTrip(trip);
    });
  }

  async function handleStartTrip() {
    if (!activeTrip) return;
    await updateTripStatus(activeTrip.id, "in_progress");
  }

  async function handleMarkCash() {
    if (!activeTrip) return;
    setError(null);
    try {
      await markCashPayment(activeTrip.id);
    } catch (err: any) {
      setError(err.message || "Could not mark as paid in cash.");
    }
  }

  async function handleCompleteTrip() {
    if (!activeTrip) return;
    setError(null);
    try {
      await completeTrip(activeTrip.id);
      setNotice("Trip completed! Payment confirmed.");
      setActiveTrip(null);
    } catch (err: any) {
      setError(err.message || "Could not complete trip. Make sure payment is done first.");
    }
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
    <div className="relative w-full h-[calc(100vh-96px)] md:h-[calc(100vh-108px)]">
      {online ? (
        <DriverMap
          driverPos={driverPos}
          openTrips={openTrips}
          activeTrip={activeTrip}
          onAccept={handleAccept}
          fullScreen
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-sm px-6 text-center">
          Go online to see the map and start receiving requests.
        </div>
      )}

      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          disabled={!!activeTrip}
          className="border rounded-lg px-3 py-3 text-base bg-white shadow"
        >
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => setOnline((v) => !v)}
          disabled={!!activeTrip || resuming}
          className={`px-4 py-3 rounded-lg font-semibold text-base shadow ${online ? "bg-green-600 text-white" : "bg-white text-gray-800"}`}
        >
          {online ? "Online" : "Go online"}
        </button>
      </div>

      {error && (
        <div className="absolute top-20 left-3 right-3 z-20 bg-red-100 text-red-700 text-sm px-3 py-2 rounded-lg shadow">{error}</div>
      )}
      {notice && (
        <div className="absolute top-20 left-3 right-3 z-20 bg-amber-100 text-amber-700 text-sm px-3 py-2 rounded-lg shadow">{notice}</div>
      )}

      {alertTrip && !activeTrip && (
        <div className="absolute inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3 animate-pulse-once">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">New request</p>
            <p className="text-lg font-bold">
              {alertTrip.tripType === "person" ? "Passenger ride" : "Goods delivery"}
            </p>
            <p className="text-sm text-gray-600">{alertTrip.distanceKm} km &middot; {alertTrip.price} RWF</p>
            {alertTrip.goodsDescription && (
              <p className="text-sm text-gray-500">{alertTrip.goodsDescription}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAlertTrip(null)}
                className="flex-1 bg-gray-200 text-gray-800 rounded-lg py-3.5 text-base font-semibold active:bg-gray-300"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleAccept(alertTrip.id)}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold active:bg-blue-700"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTrip && (
        <div className="absolute left-0 right-0 bottom-0 z-20">
          <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-4 pt-4 pb-6 space-y-3">
            <h2 className="font-semibold">Active trip</h2>
            <p className="text-sm font-medium">
              {activeTrip.tripType === "person" ? "Passenger" : "Goods delivery"}
            </p>
            <p className="text-sm text-gray-600">{activeTrip.distanceKm} km &middot; {activeTrip.price} RWF</p>
            {activeTrip.goodsDescription && (
              <p className="text-sm text-gray-500">{activeTrip.goodsDescription}</p>
            )}
            <p className="text-sm font-medium">Status: {activeTrip.status}</p>

            {activeTrip.status === "accepted" && (
              <button
                onClick={handleStartTrip}
                className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold active:bg-blue-700"
              >
                Start trip
              </button>
            )}
            {activeTrip.status === "in_progress" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Payment:{" "}
                  {activeTrip.paymentStatus === "successful"
                    ? "Paid via Mobile Money"
                    : activeTrip.paymentStatus === "cash"
                    ? "Marked paid in cash"
                    : activeTrip.paymentStatus === "pending"
                    ? "Waiting for Mobile Money confirmation..."
                    : "Not paid yet"}
                </p>
                {activeTrip.paymentStatus !== "successful" && activeTrip.paymentStatus !== "cash" && (
                  <button
                    onClick={handleMarkCash}
                    className="w-full bg-amber-500 text-white rounded-lg py-3.5 text-base font-semibold active:bg-amber-600"
                  >
                    Mark as paid in cash (system down)
                  </button>
                )}
                <button
                  onClick={handleCompleteTrip}
                  disabled={activeTrip.paymentStatus !== "successful" && activeTrip.paymentStatus !== "cash"}
                  className="w-full bg-green-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-green-700"
                >
                  Complete trip
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}