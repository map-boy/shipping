import { useCallback, useEffect, useRef, useState } from "react";
import { publishDriverLocation, goOffline } from "../lib/drivers";
import DriverMap from "./DriverMap";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";
import {
  listenToMyOffers, listenToActiveTrip, acceptTrip, declineOffer,
  arriveAtPickup, startTrip, cancelTrip, markCashPayment, completeTrip, confirmDelivery,
  type DriverOffer, type TripRequest,
} from "../lib/trips";
import { VEHICLE_LABELS, formatRwf, type VehicleType } from "../lib/catalog";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "../context/toast";
import { devToolsEnabled } from "../lib/devTools";
import { Link } from "react-router-dom";

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
  const [busy, setBusy] = useState<null | "accept" | "decline" | "arrive" | "start" | "cash" | "complete" | "cancel" | "proof">(null);
  const [deliveryCode, setDeliveryCode] = useState("");
  const [recipientName, setRecipientName] = useState("");
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
  const needsProof = !!activeTrip?.deliveryCode && !activeTrip?.deliveryConfirmedAt;

  async function submitProof() {
    if (!activeTrip) return;
    setError(null);
    setBusy("proof");
    try {
      await confirmDelivery(activeTrip.id, deliveryCode.trim(), recipientName.trim() || undefined);
      showToast("Delivery confirmed.", "success");
      setDeliveryCode("");
      setRecipientName("");
    } catch (err) {
      const message = errorMessage(err, "That code did not match.");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(null);
    }
  }

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
          className="rounded-lg px-3 py-3 text-base bg-white shadow-[0_2px_10px_rgba(0,0,0,0.14)] font-medium"
        >
          {VEHICLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.14)] rounded-lg px-3 py-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={coldChain}
            disabled={!!activeTrip}
            onChange={(e) => setColdChain(e.target.checked)}
            className="w-4 h-4"
          />
          Cold chain
        </label>

        {devToolsEnabled && (
          <Link
            to="/driver/simulate"
            className="px-4 py-3 rounded-lg bg-white shadow-[0_2px_10px_rgba(0,0,0,0.14)] text-sm font-semibold"
          >
            Simulate
          </Link>
        )}

        <button
          onClick={() => setOnline((v) => !v)}
          disabled={!!activeTrip || resuming}
          className={`px-5 py-3 rounded-lg font-semibold text-base shadow-[0_2px_10px_rgba(0,0,0,0.14)] disabled:opacity-40 ${
            online ? "bg-ink text-white" : "bg-white text-ink"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">
                  {offer.serviceClass}
                  {offer.handling !== "ambient" ? ` · ${offer.handling}` : ""}
                </p>
                <p className="text-3xl font-bold mt-1">{formatRwf(offer.price)}</p>
              </div>
              {/* The ring drains as the exclusive hold runs out. */}
              <div className="relative w-12 h-12 shrink-0">
                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#E2E2E2" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="16" fill="none" stroke="#000000" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - Math.min(1, secondsLeft / 20))}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                  {secondsLeft}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-y border-line py-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-ink shrink-0" />
                <span className="text-base">
                  {offer.pickupDistanceKm} km away &middot; {offer.etaMin} min to pickup
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-muted shrink-0" />
                <span className="text-base text-muted">
                  {offer.tripType === "person" ? "Passenger" : "Goods"} &middot; {offer.distanceKm} km trip
                </span>
              </div>
            </div>

            {offer.goodsDescription && (
              <p className="text-sm text-muted">{offer.goodsDescription}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleDecline(offer.tripId)}
                disabled={busy !== null}
                className="btn-secondary flex-1"
              >
                {busy === "decline" ? "Passing..." : "Pass"}
              </button>
              <button
                onClick={() => handleAccept(offer.tripId)}
                disabled={busy !== null}
                className="btn-primary flex-1"
              >
                {busy === "accept" ? "Accepting..." : "Accept"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTrip && (
        <div className="absolute left-0 right-0 bottom-0 z-20">
          <div className="sheet px-5 pt-4 pb-7 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">
                  {activeTrip.serviceClass}
                  {activeTrip.handling !== "ambient" ? ` · ${activeTrip.handling}` : ""}
                </p>
                <p className="text-xl font-bold mt-0.5 capitalize">
                  {activeTrip.status.replace("_", " ")}
                </p>
              </div>
              <p className="text-2xl font-bold shrink-0">{formatRwf(activeTrip.price)}</p>
            </div>
            <p className="text-base text-muted">
              {activeTrip.tripType === "person" ? "Passenger" : "Goods"} &middot; {activeTrip.distanceKm} km
            </p>
            {activeTrip.goodsDescription && (
              <p className="text-sm text-muted">{activeTrip.goodsDescription}</p>
            )}

            {activeTrip.status === "accepted" && (
              <div className="space-y-2">
                {!activeTrip.arrivedAt && (
                  <button
                    onClick={() => runTripAction("arrive", arriveAtPickup, "Pickup arrival recorded.", "Could not record arrival.")}
                    disabled={busy !== null}
                    className="btn-secondary"
                  >
                    {busy === "arrive" ? "Saving..." : "I have arrived at pickup"}
                  </button>
                )}
                <button
                  onClick={() => runTripAction("start", startTrip, "Trip started.", "Could not start the trip.")}
                  disabled={busy !== null}
                  className="btn-primary"
                >
                  {busy === "start" ? "Starting..." : "Start trip"}
                </button>
                <button
                  onClick={() => runTripAction("cancel", cancelTrip, "Released back to other drivers.", "Could not release the job.")}
                  disabled={busy !== null}
                  className="btn-danger"
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
                    className="btn-secondary"
                  >
                    {busy === "cash" ? "Marking..." : "Take cash payment"}
                  </button>
                )}
                {needsProof && (
                  <div className="space-y-2 bg-surface rounded-lg p-4">
                    <p className="eyebrow">Proof of delivery</p>
                    <p className="text-sm text-muted">
                      Ask the recipient for the 4-digit code shown in the sender&apos;s app.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4-digit code"
                      aria-label="Delivery code"
                      value={deliveryCode}
                      onChange={(e) => setDeliveryCode(e.target.value.replace(/[^0-9]/g, ""))}
                      className="field bg-white text-2xl font-bold tracking-[0.4em] text-center"
                    />
                    <input
                      type="text"
                      placeholder="Received by (optional)"
                      aria-label="Recipient name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="field bg-white"
                    />
                    <button
                      onClick={submitProof}
                      disabled={busy !== null || deliveryCode.length !== 4}
                      className="btn-primary"
                    >
                      {busy === "proof" ? "Checking..." : "Confirm delivery"}
                    </button>
                  </div>
                )}
                {activeTrip.deliveryConfirmedAt && (
                  <p className="text-base font-semibold">
                    Delivery confirmed
                    {activeTrip.recipientName ? ` by ${activeTrip.recipientName}` : ""}.
                  </p>
                )}
                <button
                  onClick={() => runTripAction("complete", completeTrip, "Job completed.", "Could not complete the job.")}
                  disabled={busy !== null || needsProof}
                  className="btn-primary"
                >
                  {busy === "complete" ? "Completing..." : paid ? "Complete job" : "Complete job (payment outstanding)"}
                </button>
                {!paid && (
                  <p className="text-sm text-muted text-center">
                    You can finish now; the unpaid amount stays on the record.
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
