import { useState } from "react";
import { createTripRequest, listenToTrip, type TripRequest, type TripType } from "../lib/trips";
import type { VehicleType } from "../lib/drivers";
import { auth } from "../firebase";
import PaymentButton from "./PaymentButton";

const VEHICLES: { value: VehicleType; label: string; price: number }[] = [
  { value: "standard", label: "Standard", price: 2000 },
  { value: "truck", label: "Truck", price: 5000 },
  { value: "vip", label: "VIP", price: 8000 },
];

interface Props {
  userLocation: [number, number] | null;
  onTripChange?: (trip: TripRequest | null) => void;
}

export default function BookingForm({ userLocation, onTripChange }: Props) {
  const [tripType, setTripType] = useState<TripType>("person");
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [goodsDescription, setGoodsDescription] = useState("");
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedVehicle = VEHICLES.find((v) => v.value === vehicleType)!;

  function updateTrip(trip: TripRequest | null) {
    setActiveTrip(trip);
    onTripChange?.(trip);
  }

  async function handleRequest() {
    setError(null);
    if (!userLocation) {
      setError("Waiting for your location...");
      return;
    }
    if (!destLat || !destLng) {
      setError("Enter a destination latitude/longitude.");
      return;
    }
    if (!auth.currentUser) {
      setError("Please log in first.");
      return;
    }

    const [lng, lat] = userLocation;
    const tripId = await createTripRequest(
      auth.currentUser.uid,
      tripType,
      vehicleType,
      { lat, lng },
      { lat: parseFloat(destLat), lng: parseFloat(destLng) },
      tripType === "goods" ? goodsDescription : undefined
    );

    listenToTrip(tripId, updateTrip);
  }

  if (activeTrip) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
        <p className="font-medium">Trip status: {activeTrip.status}</p>
        {activeTrip.driverId && <p className="text-sm text-gray-600">Driver assigned: {activeTrip.driverId}</p>}
        {activeTrip.status === "requested" && (
          <p className="text-sm text-gray-500">Looking for a nearby driver...</p>
        )}
        {(activeTrip.status === "accepted" || activeTrip.status === "in_progress") && (
          <PaymentButton tripId={activeTrip.id} amount={selectedVehicle.price} />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setTripType("person")}
          className={`px-4 py-2 rounded text-sm font-medium ${tripType === "person" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          People
        </button>
        <button
          onClick={() => setTripType("goods")}
          className={`px-4 py-2 rounded text-sm font-medium ${tripType === "goods" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          Goods
        </button>
      </div>

      <select
        value={vehicleType}
        onChange={(e) => setVehicleType(e.target.value as VehicleType)}
        className="w-full border rounded px-3 py-2"
      >
        {VEHICLES.map((v) => (
          <option key={v.value} value={v.value}>{v.label} — {v.price} RWF</option>
        ))}
      </select>

      {tripType === "goods" && (
        <input
          type="text"
          placeholder="Describe the goods (e.g. furniture, fragile items)"
          value={goodsDescription}
          onChange={(e) => setGoodsDescription(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Destination latitude"
          value={destLat}
          onChange={(e) => setDestLat(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Destination longitude"
          value={destLng}
          onChange={(e) => setDestLng(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleRequest}
        className="w-full bg-blue-600 text-white rounded py-2 font-medium"
      >
        Request {tripType === "person" ? "ride" : "delivery"} — {selectedVehicle.price} RWF
      </button>
    </div>
  );
}

