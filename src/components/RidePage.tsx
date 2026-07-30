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
  const [sheetOpen, setSheetOpen] = useState(true);

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

      {import.meta.env.DEV && (
        <button
          onClick={seedTestDrivers}
          disabled={seeding}
          className="absolute top-3 right-3 z-20 text-xs px-3 py-2 rounded-lg bg-white shadow font-medium text-gray-700"
        >
          {seeding ? "Seeding..." : "Seed test drivers"}
        </button>
      )}

      {!sheetOpen && (
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white font-semibold px-6 py-3 rounded-full shadow-lg"
        >
          Where to?
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
            <BookingForm
              userLocation={userLocation}
              onTripChange={setActiveTrip}
              preselectedVehicle={preselectedVehicle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}