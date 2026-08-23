import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import LiveMap from "./LiveMap";
import BookingForm from "./BookingForm";
import AddressSearch from "./AddressSearch";
import PaymentButton from "./PaymentButton";
import { auth } from "../firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { listenToActiveTrip, cancelTrip, type TripRequest } from "../lib/trips";
import type { VehicleType } from "../lib/drivers";
import type { GeocodeResult } from "../lib/geocode";
import { useToast } from "../context/toast";

const STATUS_COPY: Record<string, string> = {
  requested: "Looking for a nearby driver...",
  accepted: "Driver accepted! On the way to you.",
  in_progress: "Trip in progress",
};

export default function RidePage() {
  const location = useLocation();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [trip, setTrip] = useState<TripRequest | null>(null);
  const [preselectedVehicle, setPreselectedVehicle] = useState<VehicleType | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(
    () => !!(location.state as { tripId?: string } | null)?.tripId
  );
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Follows whatever trip this rider is on, so closing the tab mid-trip and coming
  // back lands them on the live trip rather than an empty booking form.
  useEffect(() => {
    if (!user) return;
    return listenToActiveTrip(user.uid, setTrip);
  }, [user]);

  // Logging out must clear the trip view without an extra state reset in an effect.
  const activeTrip = user ? trip : null;

  async function handleCancel() {
    if (!activeTrip) return;
    setCancelling(true);
    try {
      await cancelTrip(activeTrip.id);
      showToast("Trip cancelled.", "success");
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : "Could not cancel the trip.", "error");
    } finally {
      setCancelling(false);
    }
  }

  const trackedDriverId =
    activeTrip && (activeTrip.status === "accepted" || activeTrip.status === "in_progress")
      ? activeTrip.driverId
      : null;

  return (
    <div className="relative w-full h-[calc(100vh-96px)] md:h-[calc(100vh-108px)]">
      <LiveMap
        onLocationChange={setUserLocation}
        trackedDriverId={trackedDriverId}
        onRequestVehicle={(v) => {
          setPreselectedVehicle(v);
          setSheetOpen(true);
        }}
        fullScreen
      />

      {!activeTrip && (
        <div className="absolute top-16 left-3 right-3 z-20">
          <div className="bg-white rounded-xl shadow-lg p-1">
            <AddressSearch
              placeholder="Where are you going?"
              onSelect={(place) => {
                setDestination(place);
                setSheetOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {!sheetOpen && (destination || activeTrip) && (
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white font-semibold px-6 py-3 rounded-full shadow-lg"
        >
          {activeTrip ? "Trip details" : "Choose a ride"}
        </button>
      )}

      <div
        className={`absolute left-0 right-0 bottom-0 z-20 transition-transform duration-300 ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] max-h-[75vh] overflow-y-auto">
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={() => setSheetOpen(false)}
              className="w-10 h-1.5 rounded-full bg-gray-300"
              aria-label="Collapse"
            />
          </div>
          <div className="px-4 pb-6">
            {activeTrip ? (
              <div className="space-y-3">
                <div className="rounded-lg px-4 py-3 text-center font-bold text-base bg-amber-50 text-amber-700">
                  {STATUS_COPY[activeTrip.status] ?? activeTrip.status}
                </div>
                <p className="text-sm text-gray-600 text-center">
                  {activeTrip.distanceKm} km &middot; {activeTrip.price.toLocaleString()} RWF
                </p>

                {activeTrip.status === "requested" && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full border border-red-300 text-red-600 rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Cancel request"}
                  </button>
                )}

                {(activeTrip.status === "accepted" || activeTrip.status === "in_progress") &&
                  activeTrip.paymentStatus !== "cash" && (
                    <PaymentButton
                      tripId={activeTrip.id}
                      amount={activeTrip.price}
                      paymentStatus={activeTrip.paymentStatus}
                    />
                  )}

                {activeTrip.paymentStatus === "cash" && (
                  <p className="text-center text-sm text-green-700 font-medium">
                    Your driver marked this trip as paid in cash.
                  </p>
                )}

                {activeTrip.status === "accepted" && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full border border-red-300 text-red-600 rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Cancel trip"}
                  </button>
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
