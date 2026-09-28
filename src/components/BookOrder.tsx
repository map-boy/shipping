import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DestinationPicker from "./DestinationPicker";
import RoutePreviewMap from "./RoutePreviewMap";
import { quoteFare, quoteTruckFare, type FareQuote } from "../lib/pricing";
import { createTripRequest } from "../lib/trips";
import {
  VEHICLE_LABELS, VEHICLE_CARRIES, formatRwf,
  
  type TripType, type VehicleType, type TruckPackage,
} from "../lib/catalog";
import type { GeocodeResult } from "../lib/geocode";
import { fetchRoute } from "../lib/directions";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { useToast } from "../context/toast";
import { describeCallableError, backendReachable } from "../lib/callableError";
import { ensureUser, GuestSignInError } from "../lib/ensureUser";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

type Step = 1 | 2 | 3;

/** Dropdown order puts the two the client named first. */
const VEHICLE_ORDER: VehicleType[] = ["truck", "vip", "standard", "car_hire", "bus"];

function isValidRwandaPhone(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, "");
  const msisdn = digits.startsWith("250")
    ? digits
    : digits.startsWith("0")
    ? `250${digits.slice(1)}`
    : digits.startsWith("7")
    ? `250${digits}`
    : digits;
  return /^2507[0-9]{8}$/.test(msisdn);
}

export default function BookOrder() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLang();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  // A service card on the home page links in with ?vehicle=, so the dropdown
  // starts on the service the customer actually clicked.
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("vehicle") as VehicleType | null;
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    requested && requested in VEHICLE_LABELS ? requested : "truck"
  );
  // Trucks are priced by load, so they need these before any price exists.
  const [truckPackage, setTruckPackage] = useState<TruckPackage>("tonnes");
  const [tonnes, setTonnes] = useState("1");
  const [tours, setTours] = useState("1");

  // Step 2
  const [pickup, setPickup] = useState<GeocodeResult | null>(null);
  const [dropoff, setDropoff] = useState<GeocodeResult | null>(null);
  const [picking, setPicking] = useState<null | "pickup" | "dropoff">(null);

  // Step 3
  const [quote, setQuote] = useState<FareQuote | null>(null);
  const [route, setRoute] = useState<{ km: number; min: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteErrorCode, setQuoteErrorCode] = useState<string | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  const [acceptedExtra, setAcceptedExtra] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * State updates are async, so two taps landing in the same tick would both
   * pass a `submitting` check and create two orders. A ref flips synchronously.
   */
  const inFlightRef = useRef(false);

  // Only the truck is freight-only. A bus is a 29-seat passenger charter, so
  // deriving "goods" from its "both" capability would have mislabelled it.
  const tripType: TripType = VEHICLE_CARRIES[vehicleType] === "goods" ? "goods" : "person";

  const isTruck = vehicleType === "truck";
  const byTours = truckPackage === "tours";
  const tonnesNum = Number(tonnes);
  const toursNum = Number(tours);
  const truckDetailsValid =
    !isTruck ||
    (byTours
      ? Number.isInteger(toursNum) && toursNum >= 1 && toursNum <= 100
      : Number.isFinite(tonnesNum) && tonnesNum > 0 && tonnesNum <= 30);
  const step1Valid = fullName.trim().length >= 2 && isValidRwandaPhone(phone) && truckDetailsValid;
  // Both points defaulted to the map centre in testing, which produced a 0 km
  // trip and a nonsense price. Require them to be genuinely different places.
  const samePlace =
    !!pickup &&
    !!dropoff &&
    Math.abs(pickup.lat - dropoff.lat) < 0.0005 &&
    Math.abs(pickup.lng - dropoff.lng) < 0.0005;
  const step2Valid = !!pickup && !!dropoff && !samePlace;

  /**
   * Step 3 prices itself off the two locations. The road distance comes from the
   * Directions service and is passed to the server, which re-prices it - the
   * client never decides the fare.
   */
  const runQuote = useCallback(async () => {
    if (!pickup || !dropoff) return;
    setQuoting(true);
    setQuoteError(null);
    setQuoteErrorCode(null);
    setBackendDown(false);
    try {
      let routeKm: number | undefined;
      let routeMin: number | undefined;
      try {
        const google = await loadGoogleMaps();
        const r = await fetchRoute(
          google,
          [pickup.lng, pickup.lat],
          [dropoff.lng, dropoff.lat]
        );
        if (r) {
          routeKm = r.distanceKm;
          routeMin = r.durationMin;
          setRoute({ km: r.distanceKm, min: r.durationMin });
        }
      } catch {
        // No road route: the server falls back to great-circle distance.
      }

      if (vehicleType === "truck") {
        // quoteFare excludes trucks on purpose: freight is priced by package
        // type and weight, which the generic per-km quote knows nothing about.
        const truck = await quoteTruckFare({
          pickup: { lat: pickup.lat, lng: pickup.lng },
          destination: { lat: dropoff.lat, lng: dropoff.lng },
          truckPackage,
          ...(byTours ? { tours: toursNum } : { tonnes: tonnesNum }),
          routeDistanceKm: routeKm,
          routeDurationMin: routeMin,
        });
        setQuote({
          ...truck,
          formula: truck.formula,
          label: t("vehicle.truck"),
          maxLoadKg: 30000,
          serviceClass: "express",
          handling: "ambient",
          subtotal: truck.price,
          serviceMultiplier: 1,
          handlingMultiplier: 1,
          surgeMultiplier: 1,
        } as FareQuote);
        return;
      }

      const result = await quoteFare({
        pickup: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        tripType,
        serviceClass: "express",
        handling: "ambient",
        routeDistanceKm: routeKm,
        routeDurationMin: routeMin,
      });

      const match = result.quotes.find((q) => q.vehicleType === vehicleType);
      if (!match) {
        setQuoteError(t("book.cannot_serve", { vehicle: t(`vehicle.${vehicleType}` as MsgKey) }));
        setQuote(null);
        return;
      }
      setQuote(match);
    } catch (err) {
      setQuote(null);
      const failure = describeCallableError(err, "calculate a price");
      setQuoteError(failure.message);
      setQuoteErrorCode(failure.code);
      // Distinguish "this quote failed" from "nothing is answering at all".
      if (failure.looksUndeployed) {
        setBackendDown(!(await backendReachable()));
      }
    } finally {
      setQuoting(false);
    }
  }, [pickup, dropoff, tripType, vehicleType, truckPackage, tonnesNum, toursNum, byTours, t]);

  const availableVehicles = useMemo(
    () => VEHICLE_ORDER.filter((v) => VEHICLE_LABELS[v]),
    []
  );

  async function submit() {
    if (inFlightRef.current) return;
    if (!quote || !pickup || !dropoff || !acceptedExtra) return;

    inFlightRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // No login: a guest identity is created silently so the trip still has an
      // owner for the security rules and for live tracking.
      await ensureUser();

      const tripId = await createTripRequest({
        tripType,
        vehicleType,
        serviceClass: "express",
        handling: "ambient",
        pickup: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        pickupName: pickup.name,
        destinationName: dropoff.name,
        contactName: fullName.trim(),
        contactPhone: phone.trim(),
        ...(isTruck ? { truckPackage, ...(byTours ? { tours: toursNum } : { tonnes: tonnesNum }) } : {}),
        routeDistanceKm: route?.km,
        routeDurationMin: route?.min,
      });

      // Only a real trip id means the server actually wrote the order. Anything
      // else is treated as a failure rather than announced as success.
      if (!tripId) {
        throw new Error(t("book.not_confirmed"));
      }

      showToast(t("book.placed"), "success");
      navigate("/ride", { state: { tripId } });
      return;
    } catch (err) {
      const message =
        err instanceof GuestSignInError
          ? err.message
          : describeCallableError(err, "place the order").message;
      setSubmitError(message);
      showToast(message, "error");
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  if (picking) {
    return (
      <DestinationPicker
        title={picking === "pickup" ? t("book.set_pickup") : t("book.set_dropoff")}
        confirmLabel={picking === "pickup" ? t("book.confirm_pickup") : t("book.confirm_dropoff")}
        initialCenter={
          picking === "pickup"
            ? pickup
              ? { lat: pickup.lat, lng: pickup.lng }
              : null
            : dropoff
            ? { lat: dropoff.lat, lng: dropoff.lng }
            : pickup
            ? { lat: pickup.lat, lng: pickup.lng }
            : null
        }
        onBack={() => setPicking(null)}
        onConfirm={(place) => {
          if (picking === "pickup") setPickup(place);
          else setDropoff(place);
          setPicking(null);
        }}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 pb-16">
      <h1 className="text-3xl font-bold">{t("book.title")}</h1>

      {/* Step rail */}
      <ol className="flex items-center gap-2 mt-5 mb-7">
        {([1, 2, 3] as Step[]).map((n) => (
          <li key={n} className="flex-1 flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                step >= n ? "bg-ink text-white" : "bg-surface text-muted"
              }`}
            >
              {n}
            </span>
            {n < 3 && <span className={`h-0.5 flex-1 ${step > n ? "bg-ink" : "bg-line"}`} />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="eyebrow mb-2">{t("book.details")}</p>
            <input
              type="text"
              autoComplete="name"
              placeholder={t("book.name")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field"
            />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("book.phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field mt-3"
            />
            {phone.length > 0 && !isValidRwandaPhone(phone) && (
              <p className="text-sm text-red-600 mt-1.5">
                {t("book.phone_err")}
              </p>
            )}
          </div>

          <label className="block">
            <span className="eyebrow">{t("book.vehicle")}</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as VehicleType)}
              className="field mt-2"
            >
              {availableVehicles.map((v) => (
                <option key={v} value={v}>
                  {t(`vehicle.${v}` as MsgKey)}
                </option>
              ))}
            </select>
          </label>

          {isTruck && (
            <div className="space-y-3 rounded-lg bg-surface p-4">
              <p className="eyebrow">{t("book.measure")}</p>
              <div className="flex gap-2">
                {(["tonnes", "tours"] as TruckPackage[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTruckPackage(mode)}
                    className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      truckPackage === mode
                        ? "border-ink bg-white text-ink"
                        : "border-transparent bg-white/60 text-muted"
                    }`}
                  >
                    {mode === "tonnes" ? t("book.tonnes") : t("book.tours")}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {byTours
                  ? t("book.priced_tours")
                  : t("book.priced_tonnes")}
              </p>

              <label className="block">
                <span className="eyebrow">{byTours ? t("book.n_tours") : t("book.weight")}</span>
                <input
                  type="number"
                  inputMode={byTours ? "numeric" : "decimal"}
                  min={byTours ? 1 : 0.1}
                  max={byTours ? 100 : 30}
                  step={byTours ? 1 : 0.1}
                  value={byTours ? tours : tonnes}
                  onChange={(e) => (byTours ? setTours(e.target.value) : setTonnes(e.target.value))}
                  className="field bg-white mt-1.5"
                />
                {!truckDetailsValid && (
                  <span className="block text-sm text-red-600 mt-1.5">
                    {byTours
                      ? t("book.tours_err")
                      : t("book.tonnes_err")}
                  </span>
                )}
              </label>
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!step1Valid} className="btn-primary">
            {t("book.continue")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="eyebrow">{t("book.where")}</p>

          <button
            onClick={() => setPicking("pickup")}
            className="w-full flex items-center gap-3 bg-surface rounded-lg px-4 py-4 text-left active:bg-line"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-ink shrink-0" />
            <span className="min-w-0">
              <span className="block eyebrow">{t("book.pickup")}</span>
              <span className={`block truncate ${pickup ? "text-ink font-medium" : "text-muted"}`}>
                {pickup ? pickup.name : t("book.choose_map")}
              </span>
            </span>
          </button>

          <button
            onClick={() => setPicking("dropoff")}
            className="w-full flex items-center gap-3 bg-surface rounded-lg px-4 py-4 text-left active:bg-line"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-ink shrink-0" />
            <span className="min-w-0">
              <span className="block eyebrow">{t("book.dropoff")}</span>
              <span className={`block truncate ${dropoff ? "text-ink font-medium" : "text-muted"}`}>
                {dropoff ? dropoff.name : t("book.choose_map")}
              </span>
            </span>
          </button>

          {pickup && dropoff && !samePlace && (
            <div>
              <p className="eyebrow mb-2">{t("book.check_route")}</p>
              <RoutePreviewMap
                pickup={pickup}
                dropoff={dropoff}
                onRoute={(r) => setRoute(r)}
              />
            </div>
          )}

          {samePlace && (
            <p className="text-sm text-red-600">
              {t("book.same_place")}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              {t("book.back")}
            </button>
            <button
              onClick={() => {
                setStep(3);
                void runQuote();
              }}
              disabled={!step2Valid}
              className="btn-primary flex-1"
            >
              {t("book.calc")}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <p className="eyebrow">{t("book.your_price")}</p>

          {pickup && dropoff && (
            <RoutePreviewMap pickup={pickup} dropoff={dropoff} onRoute={(r) => setRoute(r)} />
          )}

          {quoting && <p className="text-muted">{t("book.calculating")}</p>}
          {quoteError && (
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-700">{quoteError}</p>
              {backendDown && (
                <p className="text-sm text-red-700">{t("book.backend_down")}</p>
              )}
              {quoteErrorCode && (
                <p className="text-xs text-red-600 font-mono">{t("book.error_code", { code: quoteErrorCode })}</p>
              )}
            </div>
          )}

          {quote && !quoting && (
            <>
              <div className="border-y border-line py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">{t(`vehicle.${vehicleType}` as MsgKey)}</span>
                  <span className="text-3xl font-bold">{formatRwf(quote.price)}</span>
                </div>
                                <p className="text-sm text-muted mt-1">
                  {quote.roundTrip
                    ? t("book.seats_return", { seats: quote.seats ?? "", km: quote.billableKm ?? "" })
                    : route ? t("book.km_about", { km: quote.distanceKm, min: route.min }) : t("book.km", { km: quote.distanceKm })}
                </p>
              </div>

              {/* The client asked for this warning explicitly: the fare covers the
                  drop-off as declared, and going past it is chargeable. */}
              <div className="rounded-lg border-2 border-ink p-4 space-y-2">
                <p className="text-sm font-semibold">{t("book.note_title")}</p>
                <p className="text-sm">{t("book.note_a")}{" "}<span className="font-semibold">{quote.distanceKm} km</span>. {t("book.note_b")}</p>
                {t("book.note_local") && <p className="text-sm text-muted">{t("book.note_local")}</p>}
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedExtra}
                    onChange={(e) => setAcceptedExtra(e.target.checked)}
                    className="w-4 h-4 mt-0.5 shrink-0"
                  />
                  <span className="text-sm font-medium">{t("book.accept")}</span>
                </label>
              </div>
            </>
          )}

          {submitError && (
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{submitError}</p>
            </div>
          )}

          {quote && !acceptedExtra && (
            <p className="text-sm text-muted">
              {t("book.tick")}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary flex-1">
              {t("book.back")}
            </button>
            {quoteError && !quote ? (
              <button onClick={() => void runQuote()} className="btn-primary flex-1">
                {t("book.try_again")}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!quote || quoting || !acceptedExtra || submitting}
                className="btn-primary flex-1"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {submitting ? t("book.placing") : t("book.place")}
              </button>
            )}
          </div>

          <p className="text-sm text-muted text-center">
            {t("book.no_account")}
          </p>
        </div>
      )}

    </div>
  );
}



