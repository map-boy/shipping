import { useCallback, useEffect, useRef, useState } from "react";
import { publishDriverLocation, goOffline } from "../lib/drivers";
import DriverMap from "./DriverMap";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";
import {
  listenToMyOffers, listenToActiveTrip, acceptTrip, declineOffer,
  arriveAtPickup, startTrip, cancelTrip, markCashPayment, completeTrip,
  type DriverOffer, type TripRequest,
} from "../lib/trips";
import { VEHICLE_LABELS, formatRwf, type VehicleType } from "../lib/catalog";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "../context/toast";

const VEHICLE_OPTIONS = Object.entries(VEHICLE_LABELS) as [VehicleType, string][];

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

/** Counts down an exclusive offer so the driver can see it lapsing. */
function useCountdown(expiresAt: number | undefined) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

export default function DriverPage() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authChecked, setAuthChecked] = useState(false);
  const [online, setOnline] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    () => (localStorage.getItem("driverVehicleType") as VehicleType) || "standard"
  );
  const [coldChain, setColdChain] = useState(() => localStorage.getItem("driverColdChain") === "true");
  const [driverLoaded, setDriverLoaded] = useState(false);
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [trip, setTrip] = useState<TripRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "accept" | "decline" | "arrive" | "start" | "cash" | "complete" | "cancel">(null);
  const seenOfferIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    get(ref(db, `drivers/${user.uid}`))
      .then((snap) => {
        if (cancelled) return;
        const val = snap.val();
        setOnline(val?.status === "online");
        if (val?.vehicleType) setVehicleType(val.vehicleType as VehicleType);
        if (typeof val?.coldChain === "boolean") setColdChain(val.coldChain);
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
    localStorage.setItem("driverColdChain", String(coldChain));
  }, [vehicleType, coldChain]);

  useEffect(() => {
    if (!user) return;
    return listenToActiveTrip(user.uid, (t) => setTrip(t && t.driverId === user.uid ? t : null));
  }, [user]);

  const resuming = !!user && !driverLoaded;
  const activeTrip = user ? trip : null;

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
        publishDriverLocation(
          driverId, pos.coords.latitude, pos.coords.longitude, vehicleType, "online", coldChain
        ).catch(() => undefined);
      },
      (err) => {
        setError(err.message);
        showToast("Location error: " + err.message, "error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [online, vehicleType, coldChain, user, resuming, showToast]);

  // Only this driver's own offers. There is no shared board to poll.
  useEffect(() => {
    if (!user || !online || activeTrip) {
      seenOfferIds.current = new Set();
      return;
    }
    return listenToMyOffers(user.uid, (list) => {
      const fresh = list.filter((o) => !seenOfferIds.current.has(o.tripId));
      seenOfferIds.current = new Set(list.map((o) => o.tripId));
      setOffers(list);
      if (fresh.length > 0) {
        playBeep();
        showToast("You have a new job offer.", "info");
      }
    });
  }, [user, online, activeTrip, showToast]);

  // Derived, so going offline or picking up a job hides offers without a state reset.
  const offer = online && !activeTrip ? offers[0] ?? null : null;
  const secondsLeft = useCountdown(offer?.expiresAt);

  const handleAccept = useCallback(
    async (tripId: string) => {
      setError(null);
      setBusy("accept");
      try {
        await acceptTrip(tripId);
        showToast("Job accepted.", "success");
      } catch (err) {
        showToast(errorMessage(err, "That offer is no longer available."), "error");
      } finally {
        setBusy(null);
      }
    },
    [showToast]
  );

  const handleDecline = useCallback(
    async (tripId: string) => {
      setBusy("decline");
      try {
        await declineOffer(tripId);
        showToast("Passed. It has gone to the next driver.", "info");
      } catch (err) {
        showToast(errorMessage(err, "Could not pass on that offer."), "error");
      } finally {
        setBusy(null);
      }
    },
    [showToast]
  );

  async function runTripAction(
    kind: "arrive" | "start" | "cash" | "complete" | "cancel",
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
        <p className="text-gray-600">Please log in first to go online and receive job offers.</p>
      </div>
    );
  }

  const paid = activeTrip?.paymentStatus === "successful" || activeTrip?.paymentStatus === "cash";

  return (
    <div className="relative w-full h-[calc(100vh-96px)] md:h-[calc(100vh-108px)]">
      {online ? (
        <DriverMap
          driverPos={driverPos}
          openTrips={offer ? [offer] : []}
          activeTrip={activeTrip}
          onAccept={handleAccept}
          fullScreen
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-sm px-6 text-center">
          Go online to start receiving job offers.
        </div>
      )}

      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center gap-2">
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          disabled={!!activeTrip}
          aria-label="Vehicle type"
          className="border rounded-lg px-3 py-3 text-base bg-white shadow"
        >
          {VEHICLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 bg-white shadow rounded-lg px-3 py-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={coldChain}
            disabled={!!activeTrip}
            onChange={(e) => setColdChain(e.target.checked)}
            className="w-4 h-4"
          />
          Cold chain
        </label>

        <button
          onClick={() => setOnline((v) => !v)}
          disabled={!!activeTrip || resuming}
          className={`px-4 py-3 rounded-lg font-semibold text-base shadow disabled:opacity-50 ${
            online ? "bg-green-600 text-white" : "bg-white text-gray-800"
          }`}
        >
          {resuming ? "Loading..." : online ? "Online" : "Go online"}
        </button>
      </div>

      {error && (
        <div className="absolute top-20 left-3 right-3 z-20 bg-red-100 text-red-700 text-sm px-3 py-2 rounded-lg shadow">{error}</div>
      )}

      {offer && !activeTrip && online && (
        <div className="absolute inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Offered to you</p>
              <span className="text-sm font-bold text-gray-700 tabular-nums">{secondsLeft}s</span>
            </div>
            <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-[width] duration-200"
                style={{ width: `${Math.min(100, (secondsLeft / 20) * 100)}%` }}
              />
            </div>

            <p className="text-lg font-bold">
              {offer.tripType === "person" ? "Passenger ride" : "Goods delivery"}
            </p>
            <p className="text-sm text-gray-600">
              {offer.pickupDistanceKm} km away &middot; about {offer.etaMin} min to pickup
            </p>
            <p className="text-sm text-gray-600">
              Trip {offer.distanceKm} km &middot; {formatRwf(offer.price)}
            </p>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {offer.serviceClass}
              {offer.handling !== "ambient" ? ` · ${offer.handling}` : ""}
            </p>
            {offer.goodsDescription && (
              <p className="text-sm text-gray-500">{offer.goodsDescription}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleDecline(offer.tripId)}
                disabled={busy !== null}
                className="flex-1 bg-gray-200 text-gray-800 rounded-lg py-3.5 text-base font-semibold active:bg-gray-300 disabled:opacity-50"
              >
                {busy === "decline" ? "Passing..." : "Pass"}
              </button>
              <button
                onClick={() => handleAccept(offer.tripId)}
                disabled={busy !== null}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold active:bg-blue-700 disabled:opacity-50"
              >
                {busy === "accept" ? "Accepting..." : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTrip && (
        <div className="absolute left-0 right-0 bottom-0 z-20">
          <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-4 pt-4 pb-6 space-y-3 max-h-[70vh] overflow-y-auto">
            <h2 className="font-semibold">Active job</h2>
            <p className="text-sm font-medium">
              {activeTrip.tripType === "person" ? "Passenger" : "Goods delivery"}
            </p>
            <p className="text-sm text-gray-600">
              {activeTrip.distanceKm} km &middot; {formatRwf(activeTrip.price)}
            </p>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {activeTrip.serviceClass}
              {activeTrip.handling !== "ambient" ? ` · ${activeTrip.handling}` : ""}
            </p>
            {activeTrip.goodsDescription && (
              <p className="text-sm text-gray-500">{activeTrip.goodsDescription}</p>
            )}
            <p className="text-sm font-medium">Status: {activeTrip.status.replace("_", " ")}</p>

            {activeTrip.status === "accepted" && (
              <div className="space-y-2">
                {!activeTrip.arrivedAt && (
                  <button
                    onClick={() => runTripAction("arrive", arriveAtPickup, "Pickup arrival recorded.", "Could not record arrival.")}
                    disabled={busy !== null}
                    className="w-full bg-slate-800 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50"
                  >
                    {busy === "arrive" ? "Saving..." : "I have arrived at pickup"}
                  </button>
                )}
                <button
                  onClick={() => runTripAction("start", startTrip, "Trip started.", "Could not start the trip.")}
                  disabled={busy !== null}
                  className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50"
                >
                  {busy === "start" ? "Starting..." : "Start trip"}
                </button>
                <button
                  onClick={() => runTripAction("cancel", cancelTrip, "Released back to other drivers.", "Could not release the job.")}
                  disabled={busy !== null}
                  className="w-full border border-red-300 text-red-600 rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {busy === "cancel" ? "Releasing..." : "Can't make it - release job"}
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
                    ? "Paid in cash"
                    : activeTrip.paymentStatus === "pending"
                    ? "Waiting for Mobile Money confirmation..."
                    : "Not paid yet"}
                </p>
                {!paid && (
                  <button
                    onClick={() => runTripAction("cash", markCashPayment, "Marked as paid in cash.", "Could not mark as paid in cash.")}
                    disabled={busy !== null || activeTrip.paymentStatus === "pending"}
                    className="w-full bg-amber-500 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50"
                  >
                    {busy === "cash" ? "Marking..." : "Take cash payment"}
                  </button>
                )}
                <button
                  onClick={() => runTripAction("complete", completeTrip, "Job completed.", "Could not complete the job.")}
                  disabled={busy !== null}
                  className="w-full bg-green-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50"
                >
                  {busy === "complete" ? "Completing..." : paid ? "Complete job" : "Complete job (payment outstanding)"}
                </button>
                {!paid && (
                  <p className="text-xs text-gray-500 text-center">
                    You can finish the delivery now; the unpaid amount stays on the record.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
