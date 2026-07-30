import { useState, useMemo } from "react";
import { createTripRequest, listenToTrip, updateTripStatus, type TripRequest, type TripType } from "../lib/trips";
import type { VehicleType } from "../lib/drivers";
import { estimateFare } from "../lib/fare";
import { auth } from "../firebase";
import PaymentButton from "./PaymentButton";
import type { GeocodeResult } from "../lib/geocode";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "truck", label: "Truck" },
  { value: "vip", label: "VIP" },
];

interface Props {
  userLocation: [number, number] | null;
  destination: GeocodeResult | null;
  onTripChange?: (trip: TripRequest | null) => void;
  preselectedVehicle?: VehicleType | null;
}

export default function BookingForm({ userLocation, destination, onTripChange, preselectedVehicle }: Props) {
  const [tripType, setTripType] = useState<TripType>("person");
  const [vehicleType, setVehicleType] = useState<VehicleType>(preselectedVehicle || "standard");
  const [goodsDescription, setGoodsDescription] = useState("");
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rideOptions = useMemo(() => {
    if (!userLocation || !destination) return null;
    const [lng, lat] = userLocation;
    return VEHICLES.map((v) => ({
      ...v,
      estimate: estimateFare({ lat, lng }, { lat: destination.lat, lng: destination.lng }, v.value),
    }));
  }, [userLocation, destination]);

  const estimate = useMemo(() => {
    if (!userLocation || !destination) return null;
    const [lng, lat] = userLocation;
    return estimateFare({ lat, lng }, { lat: destination.lat, lng: destination.lng }, vehicleType);
  }, [userLocation, destination, vehicleType]);

  function updateTrip(trip: TripRequest | null) {
    setActiveTrip(trip);
    onTripChange?.(trip);
  }

  async function handleCancel() {
    if (!activeTrip) return;
    await updateTripStatus(activeTrip.id, "cancelled");
    updateTrip(null);
  }

  async function handleRequest() {
    setError(null);
    if (!userLocation) {
      setError("Waiting for your location...");
      return;
    }
    if (!destination) {
      setError("Please choose your destination on the map first.");
      return;
    }
    if (!auth.currentUser) {
      setError("Please log in first.");
      return;
    }

    try {
      const [lng, lat] = userLocation;
      const tripId = await createTripRequest(
        auth.currentUser.uid,
        tripType,
        vehicleType,
        { lat, lng },
        { lat: destination.lat, lng: destination.lng },
        tripType === "goods" ? goodsDescription : undefined
      );
      listenToTrip(tripId, updateTrip);
    } catch (err) {
      setError("Failed to create trip: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  if (activeTrip) {
    return (
      <div className="space-y-3">
        <p className="font-medium">Trip status: {activeTrip.status}</p>
        <p className="text-sm text-gray-600">{activeTrip.distanceKm} km &middot; {activeTrip.price} RWF</p>
        {activeTrip.driverId && <p className="text-sm text-gray-600">Driver assigned: {activeTrip.driverId}</p>}
        {activeTrip.status === "requested" && (
          <>
            <p className="text-sm text-gray-500">Looking for a nearby driver...</p>
            <button onClick={handleCancel} className="w-full bg-gray-200 text-gray-800 rounded-lg py-3.5 text-base font-semibold active:bg-gray-300">
              Cancel request
            </button>
          </>
        )}
        {(activeTrip.status === "accepted" || activeTrip.status === "in_progress") && (
          <PaymentButton tripId={activeTrip.id} amount={activeTrip.price} paymentStatus={activeTrip.paymentStatus} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setTripType("person")}
          className={`px-4 py-3 rounded-lg text-base font-medium min-h-[44px] ${tripType === "person" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          People
        </button>
        <button
          onClick={() => setTripType("goods")}
          className={`px-4 py-3 rounded-lg text-base font-medium min-h-[44px] ${tripType === "goods" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          Goods
        </button>
      </div>

      {tripType === "goods" && (
        <input
          type="text"
          placeholder="Describe the goods (e.g. furniture, fragile items)"
          value={goodsDescription}
          onChange={(e) => setGoodsDescription(e.target.value)}
          className="w-full border rounded-lg px-3 py-3 text-base"
        />
      )}

      {!destination && (
        <p className="text-sm text-gray-500">Search your destination on the map above to see prices.</p>
      )}
      {destination && (
        <p className="text-sm text-gray-500">Destination: {destination.name}</p>
      )}

      {rideOptions ? (
        <div className="space-y-2">
          {rideOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVehicleType(opt.value)}
              className={`w-full flex items-center justify-between border rounded-lg px-3 py-3 text-left min-h-[44px] ${
                vehicleType === opt.value ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <span>
                  <span className="block font-medium">{opt.label}</span>
                  <span className="block text-xs text-gray-500">{opt.estimate.distanceKm} km</span>
                </span>
              </span>
              <span className="font-medium">{opt.estimate.price} RWF</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {VEHICLES.map((v) => (
            <button
              key={v.value}
              onClick={() => setVehicleType(v.value)}
              className={`w-full flex items-center gap-2 border rounded-lg px-3 py-3 text-left min-h-[44px] ${
                vehicleType === v.value ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              <span className="font-medium">{v.label}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleRequest}
        disabled={!estimate}
        className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-blue-700"
      >
        {estimate
          ? `Request ${tripType === "person" ? "ride" : "delivery"} \u00b7 ${estimate.price} RWF`
          : `Choose a destination to see price`}
      </button>
    </div>
  );
}