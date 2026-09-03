import { useCallback, useEffect, useState } from "react";
import AddressSearch from "./AddressSearch";
import { ensureAnonymousAuth } from "../firebase";
import { getRoadDistance } from "../lib/distance";
import { quoteTruckFare, type TruckFareQuote } from "../lib/pricing";
import { createTripRequest, listenToTrip, type TripRequest } from "../lib/trips";
import { formatRwf, TRUCK_LOOSE_TONNES, type TruckPackage } from "../lib/catalog";
import type { GeocodeResult } from "../lib/geocode";
import { useToast } from "../context/toast";

const STATUS_COPY: Record<string, string> = {
  requested: "Looking for a truck driver...",
  accepted: "Driver assigned, on the way to pickup",
  in_progress: "Cargo is on the way",
  completed: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Standalone truck freight quick-book: no login screen, no account. Anonymous
 * auth happens silently at booking time (see ensureAnonymousAuth) purely so
 * the existing dispatch/trip machinery has a uid to attach the job to.
 */
export default function TruckBookingForm() {
  const { showToast } = useToast();

  const [pickup, setPickup] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [truckPackage, setTruckPackage] = useState<TruckPackage>("packaged");
  const [tonnes, setTonnes] = useState("1");
  const [contactPhone, setContactPhone] = useState("");

  const [route, setRoute] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [quote, setQuote] = useState<TruckFareQuote | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [trip, setTrip] = useState<TripRequest | null>(null);

  const parsedTonnes = truckPackage === "loose" ? TRUCK_LOOSE_TONNES : Number(tonnes);

  const calculate = useCallback(async () => {
    if (!pickup || !destination) {
      setRoute(null);
      setQuote(null);
      return;
    }
    if (truckPackage === "packaged" && (!Number.isFinite(parsedTonnes) || parsedTonnes <= 0)) {
      setQuote(null);
      return;
    }
    setCalculating(true);
    setError(null);
    try {
      const road = await getRoadDistance(
        { lat: pickup.lat, lng: pickup.lng },
        { lat: destination.lat, lng: destination.lng }
      );
      setRoute(road);
      const result = await quoteTruckFare({
        pickup: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        truckPackage,
        tonnes: parsedTonnes,
        routeDistanceKm: road.distanceKm,
        routeDurationMin: road.durationMin,
      });
      setQuote(result);
    } catch (err) {
      setRoute(null);
      setQuote(null);
      setError(err instanceof Error ? err.message : "Could not calculate the price.");
    } finally {
      setCalculating(false);
    }
  }, [pickup, destination, truckPackage, parsedTonnes]);

  useEffect(() => {
    const timer = setTimeout(() => void calculate(), 400);
    return () => clearTimeout(timer);
  }, [calculate]);

  useEffect(() => {
    if (!tripId) return;
    return listenToTrip(tripId, setTrip);
  }, [tripId]);

  async function handleBook() {
    setError(null);
    if (!pickup || !destination) {
      setError("Choose where the cargo is coming from and going to.");
      return;
    }
    if (!quote) {
      setError("Waiting for the price to calculate.");
      return;
    }
    if (!contactPhone.trim()) {
      setError("Enter a phone number the driver can reach you on.");
      return;
    }
    setBooking(true);
    try {
      await ensureAnonymousAuth();
      const id = await createTripRequest({
        tripType: "goods",
        vehicleType: "truck",
        serviceClass: "express",
        handling: "ambient",
        pickup: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        truckPackage,
        tonnes: parsedTonnes,
        contactPhone: contactPhone.trim(),
        routeDistanceKm: route?.distanceKm,
        routeDurationMin: route?.durationMin,
      });
      setTripId(id);
      showToast("Truck booked.", "success");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not book the truck.");
    } finally {
      setBooking(false);
    }
  }

  if (tripId && trip) {
    return (
      <div className="max-w-md mx-auto p-5 space-y-4">
        <p className="text-2xl font-bold text-center">{STATUS_COPY[trip.status] ?? trip.status}</p>
        <div className="flex items-center justify-between border-y border-line py-3">
          <span className="text-muted">{trip.distanceKm} km</span>
          <span className="text-lg font-semibold">{formatRwf(trip.price)}</span>
        </div>
        {trip.deliveryCode && (
          <div className="rounded-lg bg-surface p-4 text-center">
            <p className="eyebrow">Delivery code</p>
            <p className="text-4xl font-bold tracking-[0.35em] mt-1.5 ml-[0.35em]">{trip.deliveryCode}</p>
            <p className="text-sm text-muted mt-1.5">Give this to the driver only when the cargo arrives.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-5 space-y-4">
      <h1 className="text-2xl font-bold">Book a truck</h1>

      <div>
        <p className="eyebrow mb-2">Cargo is coming from</p>
        <AddressSearch placeholder="Pickup location" onSelect={setPickup} />
        {pickup && <p className="text-sm text-muted mt-1 truncate">{pickup.name}</p>}
      </div>

      <div>
        <p className="eyebrow mb-2">Cargo is going to</p>
        <AddressSearch placeholder="Destination" onSelect={setDestination} />
        {destination && <p className="text-sm text-muted mt-1 truncate">{destination.name}</p>}
      </div>

      <div>
        <p className="eyebrow mb-2">Package type</p>
        <div className="flex gap-2">
          <button
            onClick={() => setTruckPackage("packaged")}
            className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
              truckPackage === "packaged" ? "border-ink bg-white text-ink" : "border-transparent bg-surface text-muted"
            }`}
          >
            Packaged (boxed/crated)
          </button>
          <button
            onClick={() => setTruckPackage("loose")}
            className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
              truckPackage === "loose" ? "border-ink bg-white text-ink" : "border-transparent bg-surface text-muted"
            }`}
          >
            Loose (furniture, whole truck)
          </button>
        </div>
      </div>

      {truckPackage === "packaged" ? (
        <div>
          <p className="eyebrow mb-2">Weight (tonnes)</p>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={tonnes}
            onChange={(e) => setTonnes(e.target.value)}
            className="field"
          />
        </div>
      ) : (
        <p className="text-sm text-muted">Billed as a full {TRUCK_LOOSE_TONNES}-tonne truck.</p>
      )}

      <div>
        <p className="eyebrow mb-2">Phone number</p>
        <input
          type="tel"
          placeholder="078..."
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="field"
        />
      </div>

      {calculating && <p className="text-sm text-muted">Calculating...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {quote && route && (
        <div className="flex items-center justify-between border-y border-line py-3">
          <span className="text-muted">{route.distanceKm} km &middot; {route.durationMin} min</span>
          <span className="text-lg font-semibold">{formatRwf(quote.price)}</span>
        </div>
      )}

      <button onClick={handleBook} disabled={!quote || booking} className="btn-primary">
        {booking ? "Booking..." : quote ? `Book truck - ${formatRwf(quote.price)}` : "Enter pickup and destination"}
      </button>
    </div>
  );
}