import { useCallback, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  SERVICE_CLASSES, HANDLING_OPTIONS, formatRwf,
  BUS_SEATS, BUS_RATE_PER_KM_SEAT, BUS_MINIMUM_RWF, BUS_MINIMUM_EACH_WAY_KM,
  type Handling, type ServiceClass, type TripType, type VehicleType,
} from "../lib/catalog";
import { quoteFare, type FareQuote, type MarketSnapshot } from "../lib/pricing";
import type { GeocodeResult } from "../lib/geocode";
import { useToast } from "../context/toast";
import { useCart } from "../context/cart";
import { describeCallableError } from "../lib/callableError";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

interface Props {
  userLocation: [number, number] | null;
  destination: GeocodeResult | null;
  preselectedVehicle?: VehicleType | null;
  routeDistanceKm?: number;
  routeDurationMin?: number;
}

const VEHICLE_GLYPH: Record<VehicleType, string> = {
  standard: "\u{1F697}",
  car_hire: "\u{1F695}",
  bus: "\u{1F68C}",
  truck: "\u{1F69B}",
  vip: "\u{1F699}",
};

function windowLabel(promisedBy: number, serviceClass: ServiceClass, t: (k: MsgKey, v?: Record<string, string | number>) => string, locale: string): string {
  if (serviceClass === "express") return t("ride.today");
  const days = Math.round((promisedBy - Date.now()) / (24 * 60 * 60 * 1000));
  return t("ride.by", { date: new Date(promisedBy).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }), days });
}

export default function BookingForm({
  userLocation, destination, preselectedVehicle, routeDistanceKm, routeDurationMin,
}: Props) {
  const { showToast } = useToast();
  const { addToCart } = useCart();
  const { t, locale } = useLang();

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
      const message = describeCallableError(err, "get a price").message;
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
      showToast(t("ride.waiting_loc"), "error");
      return;
    }
    if (!destination) {
      showToast(t("ride.choose_dest_first"), "error");
      return;
    }
    if (!auth.currentUser) {
      showToast(t("ride.login_first"), "error");
      return;
    }
    if (!selected) return;
    if (tripType === "goods" && !goodsDescription.trim()) {
      setError(t("ride.describe"));
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
    showToast(tripType === "person" ? t("ride.added_ride") : t("ride.added_delivery"), "success");
    setGoodsDescription("");
  }

  const surging = (market?.surgeMultiplier ?? 1) > 1 && serviceClass === "express";

  return (
    <div className="space-y-4">
      <div className="flex bg-surface rounded-lg p-1">
        {(["person", "goods"] as TripType[]).map((tt) => (
          <button
            key={tt}
            onClick={() => setTripType(tt)}
            className={`flex-1 px-4 py-2.5 rounded-md text-base font-semibold transition-colors ${
              tripType === tt ? "bg-white text-ink shadow-sm" : "text-muted"
            }`}
          >
            {tt === "person" ? t("ride.ride") : t("ride.send")}
          </button>
        ))}
      </div>

      {tripType === "goods" && (
        <>
          <input
            type="text"
            placeholder={t("ride.what")}
            value={goodsDescription}
            onChange={(e) => setGoodsDescription(e.target.value)}
            className="field"
          />

          <div>
            <p className="eyebrow mb-2">{t("ride.speed")}</p>
            <div className="space-y-2">
              {SERVICE_CLASSES.map((sc) => (
                <button
                  key={sc.value}
                  onClick={() => setGoodsServiceClass(sc.value)}
                  className={`choice-row ${serviceClass === sc.value ? "choice-row-on" : "choice-row-off"}`}
                >
                  <span>
                    <span className="block font-semibold">{t(`sc.${sc.value}.label` as MsgKey)}</span>
                    <span className="block text-sm text-muted">{t(`sc.${sc.value}.desc` as MsgKey)}</span>
                  </span>
                  <span className="text-sm font-semibold shrink-0 ml-3">{t(`sc.${sc.value}.window` as MsgKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">{t("ride.temp")}</p>
            <div className="flex gap-2">
              {HANDLING_OPTIONS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setGoodsHandling(h.value)}
                  title={t(`hd.${h.value}.detail` as MsgKey)}
                  className={`flex-1 px-2 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    handling === h.value ? "border-ink bg-white text-ink" : "border-transparent bg-surface text-muted"
                  }`}
                >
                  {h.value === "ambient" ? t("ride.rt") : t(`hd.${h.value}.label` as MsgKey)}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted mt-1.5">
              {t(`hd.${handling}.detail` as MsgKey)}
            </p>
          </div>
        </>
      )}

      {!destination && (
        <p className="text-sm text-muted">{t("ride.choose_dest")}</p>
      )}
      {destination && (
        <div className="flex items-center gap-3 py-1">
          <span className="w-2.5 h-2.5 bg-ink rounded-[2px] shrink-0" />
          <span className="text-base truncate">{destination.name}</span>
        </div>
      )}

      {surging && (
        <p className="text-sm bg-surface text-ink rounded-lg px-4 py-3 font-medium">
          {t("ride.busy", { x: market!.surgeMultiplier })}
        </p>
      )}

      {loadingQuotes && <p className="text-sm text-muted">{t("ride.getting")}</p>}
      {(error || quoteError) && <p className="text-red-600 text-sm">{error ?? quoteError}</p>}

      {quotes.length > 0 && (
        <div className="space-y-2">
          {quotes.map((q) => (
            <button
              key={q.vehicleType}
              onClick={() => setChosenVehicle(q.vehicleType)}
              className={`choice-row ${vehicleType === q.vehicleType ? "choice-row-on" : "choice-row-off"}`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0" aria-hidden="true">{VEHICLE_GLYPH[q.vehicleType]}</span>
                <span className="min-w-0">
                  <span className="block font-semibold truncate">
                    {t(`vehicle.${q.vehicleType}` as MsgKey)}
                    {q.roundTrip ? t("ride.charter") : ""}
                  </span>
                  <span className="block text-sm text-muted truncate">
                    {q.roundTrip ? t("ride.seats_return", { seats: q.seats ?? "", km: q.billableKm ?? "" }) : [windowLabel(q.promisedBy, q.serviceClass, t, locale), t("ride.km", { km: q.distanceKm }), q.maxLoadKg ? t("ride.kg", { kg: q.maxLoadKg }) : ""].filter(Boolean).join(" \u00b7 ")}
                  </span>
                </span>
              </span>
              <span className="font-semibold shrink-0 ml-3">{formatRwf(q.price)}</span>
            </button>
          ))}
        </div>
      )}

      {selected?.roundTrip && (
        <div className="rounded-lg bg-surface px-4 py-3 space-y-1">
          <p className="eyebrow">{t("ride.charter_title")}</p>
          {selected.minimumApplied ? (
            <p className="text-sm">{t("ride.flat", { km: BUS_MINIMUM_EACH_WAY_KM, amount: formatRwf(BUS_MINIMUM_RWF) })}</p>
          ) : (
            <p className="text-sm">{t("ride.formula", { rate: BUS_RATE_PER_KM_SEAT, seats: BUS_SEATS, km: selected.billableKm ?? "", amount: formatRwf(selected.price) })}</p>
          )}
          <p className="text-sm text-muted">{t("ride.each_way", { km: selected.eachWayKm ?? "" })}</p>
        </div>
      )}

      <button
        onClick={handleAddToCart}
        disabled={!selected || loadingQuotes}
        className="btn-primary"
      >
        {selected ? t("ride.add", { glyph: VEHICLE_GLYPH[selected.vehicleType], price: formatRwf(selected.price) }) : t("ride.choose_dest_btn")}
      </button>
    </div>
  );
}
