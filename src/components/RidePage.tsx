import { useEffect, useRef, useState } from "react";
import LiveMap from "./LiveMap";
import BookingForm from "./BookingForm";
import PaymentButton from "./PaymentButton";
import DestinationPicker from "./DestinationPicker";
import { auth } from "../firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { listenToActiveTrip, cancelTrip, dispatchTick, type TripRequest } from "../lib/trips";
import { formatRwf, type VehicleType } from "../lib/catalog";
import type { GeocodeResult } from "../lib/geocode";
import { useToast } from "../context/toast";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

const STATUS_COPY: Record<string, MsgKey> = {
  requested: "ride.st.requested",
  accepted: "ride.st.accepted",
  in_progress: "ride.st.in_progress",
};

export default function RidePage() {
  const { showToast } = useToast();
  const { t, locale } = useLang();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [trip, setTrip] = useState<TripRequest | null>(null);
  const [preselectedVehicle, setPreselectedVehicle] = useState<VehicleType | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [pickingDestination, setPickingDestination] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const tickingRef = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    return listenToActiveTrip(user.uid, setTrip);
  }, [user]);

  const activeTrip = user ? trip : null;

  /**
   * Watchdog. If the driver who holds the offer neither accepts nor passes, the
   * offer lapses on a clock that nothing else is watching. The rider's app is
   * already listening to the trip, so it nudges dispatch to the next driver.
   * The server re-checks expiry, so an early nudge is a no-op.
   */
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== "requested") return;
    const id = setInterval(async () => {
      const expiresAt = activeTrip.offerExpiresAt;
      if (typeof expiresAt === "number" && expiresAt > Date.now()) return;
      if (tickingRef.current) return;
      tickingRef.current = true;
      try {
        await dispatchTick(activeTrip.id);
      } catch {
        // a losing race with the driver accepting is fine
      } finally {
        tickingRef.current = false;
      }
    }, 3000);
    return () => clearInterval(id);
  }, [activeTrip]);

  async function handleCancel() {
    if (!activeTrip) return;
    setCancelling(true);
    try {
      await cancelTrip(activeTrip.id);
      showToast(t("trip.cancelled"), "success");
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : t("trip.cancel_fail"), "error");
    } finally {
      setCancelling(false);
    }
  }

  const trackedDriverId =
    activeTrip && (activeTrip.status === "accepted" || activeTrip.status === "in_progress")
      ? activeTrip.driverId
      : null;

  if (pickingDestination) {
    return (
      <DestinationPicker
        initialCenter={
          destination
            ? { lat: destination.lat, lng: destination.lng }
            : userLocation
            ? { lat: userLocation[1], lng: userLocation[0] }
            : null
        }
        onBack={() => setPickingDestination(false)}
        onConfirm={(place) => {
          setDestination(place);
          setPickingDestination(false);
          setSheetOpen(true);
        }}
      />
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-96px)] md:h-[calc(100vh-108px)]">
      <LiveMap
        onLocationChange={setUserLocation}
        trackedDriverId={trackedDriverId}
        destination={
          activeTrip && trackedDriverId
            ? activeTrip.destination
            : destination
            ? { lat: destination.lat, lng: destination.lng }
            : null
        }
        tripStatus={
          activeTrip?.status === "in_progress"
            ? "in_progress"
            : activeTrip?.status === "accepted"
            ? "accepted"
            : null
        }
        onRequestVehicle={(v) => {
          setPreselectedVehicle(v);
          if (!destination) setPickingDestination(true);
          else setSheetOpen(true);
        }}
        fullScreen
      />

      {!activeTrip && (
        <div className="absolute top-16 left-3 right-3 z-20">
          <button
            onClick={() => setPickingDestination(true)}
            className="w-full flex items-center gap-3 bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.16)] px-4 py-4 text-left active:bg-surface"
          >
            <span className="w-2.5 h-2.5 bg-ink rounded-[2px] shrink-0" />
            <span className={`flex-1 truncate text-lg font-semibold ${destination ? "text-ink" : "text-muted"}`}>
              {destination ? destination.name : t("trip.where")}
            </span>
          </button>
        </div>
      )}

      {!sheetOpen && (destination || activeTrip) && (
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-ink text-white font-semibold px-6 py-3.5 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.28)] active:bg-ink2"
        >
          {activeTrip ? t("trip.details") : t("trip.choose")}
        </button>
      )}

      <div
        className={`absolute left-0 right-0 bottom-0 z-20 transition-transform duration-300 ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="sheet max-h-[78vh] overflow-y-auto">
          <div className="flex justify-center pt-2.5 pb-1.5">
            <button
              onClick={() => setSheetOpen(false)}
              className="w-9 h-1 rounded-full bg-line"
              aria-label={t("trip.collapse")}
            />
          </div>
          <div className="px-5 pb-7">
            {activeTrip ? (
              <div className="space-y-3">
                <p className="text-2xl font-bold text-center pt-1">
                  {STATUS_COPY[activeTrip.status] ? t(STATUS_COPY[activeTrip.status]) : activeTrip.status}
                </p>

                {activeTrip.status === "requested" && (
                  <p className="text-sm text-center text-muted">
                    {t("trip.contacting")}
                    {activeTrip.offerRound ? ` (${activeTrip.offerRound})` : ""}
                  </p>
                )}
                {activeTrip.status === "accepted" && activeTrip.etaToPickupMin != null && (
                  <p className="text-base text-center text-muted">
                    {activeTrip.arrivedAt ? t("trip.arrived") : t("trip.eta", { min: activeTrip.etaToPickupMin })}
                  </p>
                )}

                <div className="flex items-center justify-between border-y border-line py-3">
                  <span className="text-muted">{activeTrip.distanceKm} km</span>
                  <span className="text-lg font-semibold">{formatRwf(activeTrip.price)}</span>
                </div>
                {activeTrip.fare && activeTrip.fare.surgeMultiplier > 1 && (
                  <p className="text-sm text-center text-muted">
                    {t("trip.surge", { x: activeTrip.fare.surgeMultiplier })}
                  </p>
                )}
                {activeTrip.promisedBy && activeTrip.serviceClass !== "express" && (
                  <p className="text-sm text-center text-muted">
                    {t("trip.promised", { date: new Date(activeTrip.promisedBy).toLocaleDateString(locale) })}
                  </p>
                )}

                {activeTrip.deliveryCode && activeTrip.status !== "requested" && (
                  <div className="rounded-lg bg-surface p-4 text-center">
                    <p className="eyebrow">{t("trip.code")}</p>
                    <p className="text-4xl font-bold tracking-[0.35em] mt-1.5 ml-[0.35em]">{activeTrip.deliveryCode}</p>
                    <p className="text-sm text-muted mt-1.5">
                      {activeTrip.deliveryConfirmedAt
                        ? t("trip.confirmed")
                        : t("trip.give_code")}
                    </p>
                  </div>
                )}

                {(activeTrip.status === "requested" || activeTrip.status === "accepted") && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="btn-danger"
                  >
                    {cancelling ? t("trip.cancelling") : t("trip.cancel")}
                  </button>
                )}

                {(activeTrip.status === "accepted" || activeTrip.status === "in_progress") &&
                  activeTrip.paymentStatus !== "cash" && (
                    <PaymentButton
                      tripId={activeTrip.id}
                      amount={activeTrip.price}
                      paymentStatus={activeTrip.paymentStatus} paymentProvider={(activeTrip as unknown as { paymentProvider?: string }).paymentProvider}
                    />
                  )}

                {activeTrip.paymentStatus === "cash" && (
                  <p className="text-center text-base font-medium">
                    {t("trip.paid_cash")}
                  </p>
                )}
              </div>
            ) : (
              <BookingForm
                userLocation={userLocation}
                destination={destination}
                preselectedVehicle={preselectedVehicle}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
