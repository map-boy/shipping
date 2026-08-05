import { useState, useMemo } from "react";
import type { TripType } from "../lib/trips";
import type { VehicleType } from "../lib/drivers";
import { estimateFare } from "../lib/fare";
import { auth } from "../firebase";
import type { GeocodeResult } from "../lib/geocode";
import { useToast } from "./Toast";
import { useCart } from "./Cart";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "truck", label: "Truck" },
  { value: "vip", label: "VIP" },
];

interface Props {
  userLocation: [number, number] | null;
  destination: GeocodeResult | null;
  preselectedVehicle?: VehicleType | null;
}

export default function BookingForm({ userLocation, destination, preselectedVehicle }: Props) {
  const { showToast } = useToast();
  const { addToCart } = useCart();
  const [tripType, setTripType] = useState<TripType>("person");
  const [vehicleType, setVehicleType] = useState<VehicleType>(preselectedVehicle || "standard");
  const [goodsDescription, setGoodsDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  function handleAddToCart() {
    setError(null);
    if (!userLocation) {
      setError("Waiting for your location...");
      showToast("Waiting for your location...", "error");
      return;
    }
    if (!destination) {
      setError("Please choose your destination on the map first.");
      showToast("Please choose your destination first.", "error");
      return;
    }
    if (!auth.currentUser) {
      setError("Please log in first.");
      showToast("Please log in first.", "error");
      return;
    }
    if (!estimate) return;

    setAdding(true);
    try {
      const [lng, lat] = userLocation;
      addToCart({
        tripType,
        vehicleType,
        pickup: { lat, lng },
        destination: { lat: destination.lat, lng: destination.lng },
        destinationName: destination.name,
        goodsDescription: tripType === "goods" ? goodsDescription : undefined,
        distanceKm: estimate.distanceKm,
        price: estimate.price,
      });
      showToast(tripType === "person" ? "Ride added to cart." : "Delivery added to cart.", "success");
      setGoodsDescription("");
    } finally {
      setAdding(false);
    }
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
        onClick={handleAddToCart}
        disabled={!estimate || adding}
        className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-blue-700 flex items-center justify-center gap-2"
      >
        {adding && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {adding
          ? "Adding..."
          : estimate
          ? `Add to cart \u00b7 ${estimate.price} RWF`
          : `Choose a destination to see price`}
      </button>
    </div>
  );
}