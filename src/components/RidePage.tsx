import { useState } from "react";
import LiveMap from "./LiveMap";
import BookingForm from "./BookingForm";
import { publishDriverLocation, type VehicleType } from "../lib/drivers";
import type { TripRequest } from "../lib/trips";

export default function RidePage() {
  const [seeding, setSeeding] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripRequest | null>(null);
  const [preselectedVehicle, setPreselectedVehicle] = useState<VehicleType | null>(null);

  async function seedTestDrivers() {
    setSeeding(true);
    await publishDriverLocation("driver1", -1.9450, 30.0610, "standard", "online");
    await publishDriverLocation("driver2", -1.9430, 30.0630, "truck", "online");
    await publishDriverLocation("driver3", -1.9440, 30.0600, "vip", "online");
    setSeeding(false);
  }

  const trackedDriverId =
    activeTrip && (activeTrip.status === "accepted" || activeTrip.status === "in_progress")
      ? activeTrip.driverId
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Find a ride</h1>
        {import.meta.env.DEV && (
          <button
            onClick={seedTestDrivers}
            disabled={seeding}
            className="text-xs px-3 py-1 rounded bg-gray-200 text-gray-700"
          >
            {seeding ? "Seeding..." : "Seed test drivers (dev only)"}
          </button>
        )}
      </div>
      <LiveMap
        onLocationChange={setUserLocation}
        trackedDriverId={trackedDriverId}
        onRequestVehicle={setPreselectedVehicle}
      />
      <BookingForm
        userLocation={userLocation}
        onTripChange={setActiveTrip}
        preselectedVehicle={preselectedVehicle}
      />
    </div>
  );
}