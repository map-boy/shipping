import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  SERVICE_CLASSES, HANDLING_OPTIONS, formatRwf,
  type Handling, type ServiceClass, type TripType, type VehicleType,
} from "../lib/catalog";
import { quoteFare, type FareQuote, type MarketSnapshot } from "../lib/pricing";
import type { GeocodeResult } from "../lib/geocode";
import { useToast } from "../context/toast";
import { useCart } from "../context/cart";

interface Props {
  userLocation: [number, number] | null;
  destination: GeocodeResult | null;
  preselectedVehicle?: VehicleType | null;
  routeDistanceKm?: number;
  routeDurationMin?: number;
}

function windowLabel(promisedBy: number, serviceClass: ServiceClass): string {
  if (serviceClass === "express") return "Today";
  const days = Math.round((promisedBy - Date.now()) / (24 * 60 * 60 * 1000));
  return `By ${new Date(promisedBy).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} (${days}d)`;
}

export default function BookingForm({
  userLocation, destination, preselectedVehicle, routeDistanceKm, routeDurationMin,
}: Props) {
  const { showToast } = useToast();
  const { addToCart } = useCart();

  const [tripType, setTripType] = useState<TripType>("person");
  const [goodsServiceClass, setGoodsServiceClass] = useState<ServiceClass>("first");
  const [goodsHandling, setGoodsHandling] = useState<Handling>("ambient");
  const [goodsDescription, setGoodsDescription] = useState("");

  const [quoteState, setQuoteState] = useState<{
    quotes: FareQuote[];
    market: MarketSnapshot | null;
    loading: boolean;
    error: string | null;
  }>({ quotes: [], market: null, loading: false, error: null });
  const [chosenVehicle, setChosenVehicle] = useState<VehicleType | null>(preselectedVehicle ?? null);
  const [error, setError] = useState<string | null>(null);

  const { quotes, market, loading: loadingQuotes } = quoteState;

  // Passenger trips are always immediate and never temperature controlled, so
  // these are derived from the trip type rather than synced to it in an effect.
  const serviceClass: ServiceClass = tripType === "person" ? "express" : goodsServiceClass;
  const handling: Handling = tripType === "person" ? "ambient" : goodsHandling;

  const fetchQuotes = useCallback(async () => {
    if (!userLocation || !destination) {
      setQuoteState({ quotes: [], market: null, loading: false, error: null });
      return;
    }
    const [lng, lat] = userLocation;
    setQuoteState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await quoteFare({
        pickup: { lat, lng },
        destination: { lat: destination.lat, lng: destination.lng },
        tripType,
        serviceClass,
        handling,
        routeDistanceKm,
        routeDurationMin,
      });
      setQuoteState({ quotes: result.quotes, market: result.market, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Could not get a price right now.";
      setQuoteState({ quotes: [], market: null, loading: false, error: message });
    }
  }, [userLocation, destination, tripType, serviceClass, handling, routeDistanceKm, routeDurationMin]);

  useEffect(() => {
    // Pricing lives on the server, so this effect exists to call out to it. The
    // loading flag it raises first is exactly the "in flight" state the UI needs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQuotes();
  }, [fetchQuotes]);

  // The chosen vehicle falls back to the first quote rather than being corrected
  // by an effect after the fact.
  const selected =
    quotes.find((q) => q.vehicleType === chosenVehicle) ?? quotes[0] ?? null;
  const vehicleType = selected?.vehicleType ?? null;
  const quoteError = quoteState.error;

  function handleAddToCart() {
    setError(null);
    if (!userLocation) {
      showToast("Waiting for your location...", "error");
      return;
    }
    if (!destination) {
      showToast("Please choose your destination first.", "error");
      return;
    }
    if (!auth.currentUser) {
      showToast("Please log in first.", "error");
      return;
    }
    if (!selected) return;
    if (tripType === "goods" && !goodsDescription.trim()) {
      setError("Please describe what is being sent.");
      return;
    }

    const [lng, lat] = userLocation;
    addToCart({
      tripType,
      vehicleType: selected.vehicleType,
      serviceClass,
      handling,
      pickup: { lat, lng },
      destination: { lat: destination.lat, lng: destination.lng },
      destinationName: destination.name,
      goodsDescription: tripType === "goods" ? goodsDescription.trim() : undefined,
      distanceKm: selected.distanceKm,
      price: selected.price,
      promisedBy: selected.promisedBy,
    });
    showToast(tripType === "person" ? "Ride added to cart." : "Delivery added to cart.", "success");
    setGoodsDescription("");
  }

  const surging = (market?.surgeMultiplier ?? 1) > 1 && serviceClass === "express";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["person", "goods"] as TripType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTripType(t)}
            className={`flex-1 px-4 py-3 rounded-lg text-base font-medium min-h-[44px] ${
              tripType === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
            }`}
          >
            {t === "person" ? "People" : "Goods"}
          </button>
        ))}
      </div>

      {tripType === "goods" && (
        <>
          <input
            type="text"
            placeholder="What are you sending? (e.g. furniture, vaccines, produce)"
            value={goodsDescription}
            onChange={(e) => setGoodsDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base"
          />

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Service class</p>
            <div className="space-y-2">
              {SERVICE_CLASSES.map((sc) => (
                <button
                  key={sc.value}
                  onClick={() => setGoodsServiceClass(sc.value)}
                  className={`w-full flex items-center justify-between border rounded-lg px-3 py-3 text-left ${
                    serviceClass === sc.value ? "border-blue-600 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <span>
                    <span className="block font-medium">{sc.label}</span>
                    <span className="block text-xs text-gray-500">{sc.description}</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-700 shrink-0 ml-3">{sc.window}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Temperature</p>
            <div className="flex gap-2">
              {HANDLING_OPTIONS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setGoodsHandling(h.value)}
                  title={h.detail}
                  className={`flex-1 px-2 py-2.5 rounded-lg text-sm font-medium border ${
                    handling === h.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700"
                  }`}
                >
                  {h.value === "ambient" ? "RT" : h.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {HANDLING_OPTIONS.find((h) => h.value === handling)?.detail}
            </p>
          </div>
        </>
      )}

      {!destination && (
        <p className="text-sm text-gray-500">Choose a destination on the map to see prices.</p>
      )}
      {destination && <p className="text-sm text-gray-500 truncate">To: {destination.name}</p>}

      {surging && (
        <p className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
          Busy right now &mdash; fares are {market!.surgeMultiplier}x while demand is high.
        </p>
      )}

      {loadingQuotes && <p className="text-sm text-gray-500">Getting prices...</p>}
      {(error || quoteError) && <p className="text-red-600 text-sm">{error ?? quoteError}</p>}

      {quotes.length > 0 && (
        <div className="space-y-2">
          {quotes.map((q) => (
            <button
              key={q.vehicleType}
              onClick={() => setChosenVehicle(q.vehicleType)}
              className={`w-full flex items-center justify-between border rounded-lg px-3 py-3 text-left min-h-[44px] ${
                vehicleType === q.vehicleType ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              <span>
                <span className="block font-medium">{q.label}</span>
                <span className="block text-xs text-gray-500">
                  {q.distanceKm} km &middot; {windowLabel(q.promisedBy, q.serviceClass)}
                  {q.maxLoadKg ? ` · up to ${q.maxLoadKg} kg` : ""}
                </span>
              </span>
              <span className="font-semibold shrink-0 ml-3">{formatRwf(q.price)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleAddToCart}
        disabled={!selected || loadingQuotes}
        className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-blue-700"
      >
        {selected ? `Add to cart · ${formatRwf(selected.price)}` : "Choose a destination to see prices"}
      </button>
    </div>
  );
}
