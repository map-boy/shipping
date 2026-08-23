import { useCallback, useEffect, useRef, useState } from "react";
import { publishDriverLocation, goOffline, type VehicleType } from "../lib/drivers";
import DriverMap from "./DriverMap";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";
import {
  listenToOpenTrips,
  listenToActiveTrip,
  acceptTrip,
  startTrip,
  cancelTrip,
  markCashPayment,
  completeTrip,
  type OpenTrip,
  type TripRequest,
} from "../lib/trips";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "../context/toast";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "truck", label: "Truck" },
  { value: "vip", label: "VIP" },
];

const SEARCH_RADIUS_KM = 15;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function playBeep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const blip = (offsetSec: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      const at = ctx.currentTime + offsetSec;
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
      osc.start(at);
      osc.stop(at + 0.4);
    };
    blip(0);
    blip(0.45);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    // audio unavailable - the on-screen alert still fires
  }
}

export default function DriverPage() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authChecked, setAuthChecked] = useState(false);
  const [online, setOnline] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    () => (localStorage.getItem("driverVehicleType") as VehicleType) || "standard"
  );
  const [driverLoaded, setDriverLoaded] = useState(false);
  const [openTrips, setOpenTrips] = useState<OpenTrip[]>([]);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [trip, setTrip] = useState<TripRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertTrip, setAlertTrip] = useState<OpenTrip | null>(null);
  const [busy, setBusy] = useState<null | "accept" | "start" | "cash" | "complete" | "cancel">(null);
  const knownTripIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  // The database is the source of truth for online state, not localStorage: a driver
  // who went offline on another device must not come back online here on a refresh.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    get(ref(db, `drivers/${user.uid}`))
      .then((snap) => {
        if (cancelled) return;
        const val = snap.val();
        setOnline(val?.status === "online");
        if (val?.vehicleType) setVehicleType(val.vehicleType as VehicleType);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDriverLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem("driverVehicleType", vehicleType);
  }, [vehicleType]);

  // Recover the trip in flight after a refresh, a crash, or a second tab.
  useEffect(() => {
    if (!user) return;
    return listenToActiveTrip(user.uid, (trip) => {
      setTrip(trip && trip.driverId === user.uid ? trip : null);
    });
  }, [user]);

  // Derived rather than reset from inside an effect: signing out or going offline
  // simply stops these from rendering.
  const resuming = !!user && !driverLoaded;
  const activeTrip = user ? trip : null;
  const visibleOpenTrips = online && driverPos && !activeTrip ? openTrips : [];

  useEffect(() => {
    if (!user || resuming) return;
    const driverId = user.uid;

    if (!online) {
      goOffline(driverId).catch(() => undefined);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        publishDriverLocation(driverId, pos.coords.latitude, pos.coords.longitude, vehicleType, "online").catch(
          () => undefined
        );
      },
      (err) => {
        setError(err.message);
        showToast("Location error: " + err.message, "error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [online, vehicleType, user, resuming, showToast]);

  useEffect(() => {
    if (!online || !driverPos || activeTrip) {
      knownTripIdsRef.current = new Set();
      return;
    }
    return listenToOpenTrips(driverPos, SEARCH_RADIUS_KM, vehicleType, (trips) => {
      const newOnes = trips.filter((t) => !knownTripIdsRef.current.has(t.id));
      knownTripIdsRef.current = new Set(trips.map((t) => t.id));
      setOpenTrips(trips);
      if (newOnes.length > 0) {
        playBeep();
        setAlertTrip(newOnes[0]);
        showToast("New ride request nearby!", "info");
      }
    });
  }, [vehicleType, online, driverPos, activeTrip, showToast]);

  const handleAccept = useCallback(
    async (tripId: string) => {
      setError(null);
      setAlertTrip(null);
      setBusy("accept");
      try {
        await acceptTrip(tripId);
        showToast("Trip accepted!", "success");
        // listenToActiveTrip picks the trip up from here - no extra listener to leak.
      } catch (err) {
        showToast(errorMessage(err, "Another driver already took that trip."), "error");
      } finally {
        setBusy(null);
      }
    },
    [showToast]
  );

  async function runTripAction(
    kind: "start" | "cash" | "complete" | "cancel",
    action: (tripId: string) => Promise<void>,
    success: string,
    fallback: string
  ) {
    if (!activeTrip) return;
    setError(null);
    setBusy(kind);
    try {
      await action(activeTrip.id);
      showToast(success, "success");
    } catch (err) {
      const message = errorMessage(err, fallback);
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(null);
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

  const paid = activeTrip?.paymentStatus === "successful" || activeTrip?.paymentStatus === "cash";

  return (
    <div className="relative w-full h-[calc(100vh-96px)] md:h-[calc(100vh-108px)]">
      {online ? (
        <DriverMap
          driverPos={driverPos}
          openTrips={visibleOpenTrips}
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
          aria-label="Vehicle type"
          className="border rounded-lg px-3 py-3 text-base bg-white shadow"
        >
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => setOnline((v) => !v)}
          disabled={!!activeTrip || resuming}
          className={`px-4 py-3 rounded-lg font-semibold text-base shadow disabled:opacity-50 ${online ? "bg-green-600 text-white" : "bg-white text-gray-800"}`}
        >
          {resuming ? "Loading..." : online ? "Online" : "Go online"}
        </button>
      </div>

      {error && (
        <div className="absolute top-20 left-3 right-3 z-20 bg-red-100 text-red-700 text-sm px-3 py-2 rounded-lg shadow">{error}</div>
      )}

      {alertTrip && !activeTrip && online && (
        <div className="absolute inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3 animate-pulseOnce">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">New request</p>
            <p className="text-lg font-bold">
              {alertTrip.tripType === "person" ? "Passenger ride" : "Goods delivery"}
            </p>
            <p className="text-sm text-gray-600">{alertTrip.distanceKm} km &middot; {alertTrip.price.toLocaleString()} RWF</p>
            {alertTrip.goodsDescription && (
              <p className="text-sm text-gray-500">{alertTrip.goodsDescription}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAlertTrip(null)}
                disabled={busy === "accept"}
                className="flex-1 bg-gray-200 text-gray-800 rounded-lg py-3.5 text-base font-semibold active:bg-gray-300 disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleAccept(alertTrip.id)}
                disabled={busy === "accept"}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold active:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy === "accept" && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {busy === "accept" ? "Accepting..." : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTrip && (
        <div className="absolute left-0 right-0 bottom-0 z-20">
          <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-4 pt-4 pb-6 space-y-3 max-h-[70vh] overflow-y-auto">
            <h2 className="font-semibold">Active trip</h2>
            <p className="text-sm font-medium">
              {activeTrip.tripType === "person" ? "Passenger" : "Goods delivery"}
            </p>
            <p className="text-sm text-gray-600">{activeTrip.distanceKm} km &middot; {activeTrip.price.toLocaleString()} RWF</p>
            {activeTrip.goodsDescription && (
              <p className="text-sm text-gray-500">{activeTrip.goodsDescription}</p>
            )}
            <p className="text-sm font-medium">Status: {activeTrip.status.replace("_", " ")}</p>

            {activeTrip.status === "accepted" && (
              <div className="space-y-2">
                <button
                  onClick={() => runTripAction("start", startTrip, "Trip started.", "Could not start the trip.")}
                  disabled={busy !== null}
                  className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold active:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy === "start" && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {busy === "start" ? "Starting..." : "Start trip"}
                </button>
                <button
                  onClick={() =>
                    runTripAction("cancel", cancelTrip, "Trip released back to other drivers.", "Could not cancel the trip.")
                  }
                  disabled={busy !== null}
                  className="w-full border border-red-300 text-red-600 rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {busy === "cancel" ? "Cancelling..." : "Can't make it - release trip"}
                </button>
              </div>
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
                {!paid && (
                  <button
                    onClick={() =>
                      runTripAction("cash", markCashPayment, "Marked as paid in cash.", "Could not mark as paid in cash.")
                    }
                    disabled={busy !== null || activeTrip.paymentStatus === "pending"}
                    className="w-full bg-amber-500 text-white rounded-lg py-3.5 text-base font-semibold active:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy === "cash" && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {busy === "cash" ? "Marking..." : "Mark as paid in cash"}
                  </button>
                )}
                <button
                  onClick={() =>
                    runTripAction(
                      "complete",
                      completeTrip,
                      "Trip completed! Payment confirmed.",
                      "Could not complete trip. Make sure payment is done first."
                    )
                  }
                  disabled={busy !== null || !paid}
                  className="w-full bg-green-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-green-700 flex items-center justify-center gap-2"
                >
                  {busy === "complete" && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {busy === "complete" ? "Completing..." : "Complete trip"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
