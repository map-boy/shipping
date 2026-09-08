import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import DestinationPicker from "./DestinationPicker";
import AuthModal from "./AuthModal";
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

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [showAuth, setShowAuth] = useState(false);

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("truck");
  // Trucks are priced by load, so they need these before any price exists.
  const [truckPackage, setTruckPackage] = useState<TruckPackage>("packaged");
  const [tonnes, setTonnes] = useState("1");

  // Step 2
  const [pickup, setPickup] = useState<GeocodeResult | null>(null);
  const [dropoff, setDropoff] = useState<GeocodeResult | null>(null);
  const [picking, setPicking] = useState<null | "pickup" | "dropoff">(null);

  // Step 3
  const [quote, setQuote] = useState<FareQuote | null>(null);
  const [route, setRoute] = useState<{ km: number; min: number } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [acceptedExtra, setAcceptedExtra] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Only the truck is freight-only. A bus is a 29-seat passenger charter, so
  // deriving "goods" from its "both" capability would have mislabelled it.
  const tripType: TripType = VEHICLE_CARRIES[vehicleType] === "goods" ? "goods" : "person";

  const isTruck = vehicleType === "truck";
  const tonnesNum = Number(tonnes);
  const truckDetailsValid =
    !isTruck || truckPackage === "loose" || (Number.isFinite(tonnesNum) && tonnesNum > 0 && tonnesNum <= 30);
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
          tonnes: truckPackage === "loose" ? 30 : tonnesNum,
          routeDistanceKm: routeKm,
          routeDurationMin: routeMin,
        });
        setQuote({
          ...truck,
          label: VEHICLE_LABELS.truck,
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
        setQuoteError(`${VEHICLE_LABELS[vehicleType]} cannot serve this booking.`);
        setQuote(null);
        return;
      }
      setQuote(match);
    } catch (err) {
      setQuote(null);
      setQuoteError(
        err instanceof Error && err.message
          ? err.message
          : "Could not calculate a price. Check your connection and try again."
      );
    } finally {
      setQuoting(false);
    }
  }, [pickup, dropoff, tripType, vehicleType, truckPackage, tonnesNum]);

  const availableVehicles = useMemo(
    () => VEHICLE_ORDER.filter((v) => VEHICLE_LABELS[v]),
    []
  );

  async function submit() {
    if (!quote || !pickup || !dropoff) return;
    if (!user) {
      setShowAuth(true);
      return;
    }
    setSubmitting(true);
    try {
      const tripId = await createTripRequest({
        tripType,
        vehicleType,
        serviceClass: "express",
        handling: "ambient",
        pickup: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        contactName: fullName.trim(),
        contactPhone: phone.trim(),
        ...(isTruck
          ? { truckPackage, tonnes: truckPackage === "loose" ? 30 : tonnesNum }
          : {}),
        routeDistanceKm: route?.km,
        routeDurationMin: route?.min,
      });
      showToast("Order placed. Finding a driver...", "success");
      navigate("/ride", { state: { tripId } });
    } catch (err) {
      showToast(
        err instanceof Error && err.message ? err.message : "Could not place the order.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (picking) {
    return (
      <DestinationPicker
        title={picking === "pickup" ? "Set the pickup point" : "Set the drop-off point"}
        confirmLabel={picking === "pickup" ? "Confirm pickup" : "Confirm drop-off"}
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
      <h1 className="text-3xl font-bold">Book or order</h1>

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
            <p className="eyebrow mb-2">Your details</p>
            <input
              type="text"
              autoComplete="name"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field"
            />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Phone number, e.g. 0781234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field mt-3"
            />
            {phone.length > 0 && !isValidRwandaPhone(phone) && (
              <p className="text-sm text-red-600 mt-1.5">
                Enter a Rwandan mobile number, e.g. 0781234567.
              </p>
            )}
          </div>

          <label className="block">
            <span className="eyebrow">Vehicle</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as VehicleType)}
              className="field mt-2"
            >
              {availableVehicles.map((v) => (
                <option key={v} value={v}>
                  {VEHICLE_LABELS[v]}
                </option>
              ))}
            </select>
          </label>

          {isTruck && (
            <div className="space-y-3 rounded-lg bg-surface p-4">
              <p className="eyebrow">What is being carried</p>
              <div className="flex gap-2">
                {(["packaged", "loose"] as TruckPackage[]).map((pkg) => (
                  <button
                    key={pkg}
                    onClick={() => setTruckPackage(pkg)}
                    className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      truckPackage === pkg
                        ? "border-ink bg-white text-ink"
                        : "border-transparent bg-white/60 text-muted"
                    }`}
                  >
                    {pkg === "packaged" ? "Packaged goods" : "Loose / bulky"}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {truckPackage === "packaged"
                  ? "Boxed or crated goods, billed by weight."
                  : "Furniture and non-stackable loads take the whole bed, billed as a full 30 t load."}
              </p>

              {truckPackage === "packaged" && (
                <label className="block">
                  <span className="eyebrow">Weight in tonnes</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    max={30}
                    step={0.1}
                    value={tonnes}
                    onChange={(e) => setTonnes(e.target.value)}
                    className="field bg-white mt-1.5"
                  />
                  {!truckDetailsValid && (
                    <span className="block text-sm text-red-600 mt-1.5">
                      Enter a weight between 0.1 and 30 tonnes.
                    </span>
                  )}
                </label>
              )}
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!step1Valid} className="btn-primary">
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="eyebrow">Where from, and where to</p>

          <button
            onClick={() => setPicking("pickup")}
            className="w-full flex items-center gap-3 bg-surface rounded-lg px-4 py-4 text-left active:bg-line"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-ink shrink-0" />
            <span className="min-w-0">
              <span className="block eyebrow">Pickup</span>
              <span className={`block truncate ${pickup ? "text-ink font-medium" : "text-muted"}`}>
                {pickup ? pickup.name : "Choose on the map"}
              </span>
            </span>
          </button>

          <button
            onClick={() => setPicking("dropoff")}
            className="w-full flex items-center gap-3 bg-surface rounded-lg px-4 py-4 text-left active:bg-line"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-ink shrink-0" />
            <span className="min-w-0">
              <span className="block eyebrow">Drop-off</span>
              <span className={`block truncate ${dropoff ? "text-ink font-medium" : "text-muted"}`}>
                {dropoff ? dropoff.name : "Choose on the map"}
              </span>
            </span>
          </button>

          {samePlace && (
            <p className="text-sm text-red-600">
              Pickup and drop-off are the same place. Set a different drop-off point.
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={() => {
                setStep(3);
                void runQuote();
              }}
              disabled={!step2Valid}
              className="btn-primary flex-1"
            >
              Calculate price
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <p className="eyebrow">Your price</p>

          <div className="rounded-lg bg-surface p-4 space-y-2">
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-ink shrink-0 mt-1.5" />
              <span className="text-sm min-w-0 truncate">{pickup?.name}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-ink shrink-0 mt-1.5" />
              <span className="text-sm min-w-0 truncate">{dropoff?.name}</span>
            </div>
          </div>

          {quoting && <p className="text-muted">Calculating from the map...</p>}
          {quoteError && <p className="text-red-600 text-sm">{quoteError}</p>}

          {quote && !quoting && (
            <>
              <div className="border-y border-line py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">{VEHICLE_LABELS[vehicleType]}</span>
                  <span className="text-3xl font-bold">{formatRwf(quote.price)}</span>
                </div>
                <p className="text-sm text-muted mt-1">
                  {quote.roundTrip
                    ? `${quote.seats} seats · ${quote.billableKm} km return`
                    : `${quote.distanceKm} km${route ? ` · about ${route.min} min` : ""}`}
                </p>
              </div>

              {/* The client asked for this warning explicitly: the fare covers the
                  drop-off as declared, and going past it is chargeable. */}
              <div className="rounded-lg border-2 border-ink p-4 space-y-2">
                <p className="text-sm font-semibold">Please note</p>
                <p className="text-sm">
                  This price covers the drop-off point you set above, a distance of{" "}
                  <span className="font-semibold">{quote.distanceKm} km</span>. If the goods
                  actually have to go beyond that point, the extra distance is charged separately.
                </p>
                <p className="text-sm text-muted">
                  Iyi price ni ya aho ushyize umuzigo ugera. Nibiba ngombwa ko urenga aho,
                  urugendo rwiyongereye ruzishyurwa ukwarwo.
                </p>
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedExtra}
                    onChange={(e) => setAcceptedExtra(e.target.checked)}
                    className="w-4 h-4 mt-0.5 shrink-0"
                  />
                  <span className="text-sm font-medium">I understand and accept this.</span>
                </label>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">
              Back
            </button>
            {quoteError && !quote ? (
              <button onClick={() => void runQuote()} className="btn-primary flex-1">
                Try again
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!quote || quoting || !acceptedExtra || submitting}
                className="btn-primary flex-1"
              >
                {submitting ? "Placing..." : user ? "Place order" : "Log in to order"}
              </button>
            )}
          </div>

          {!user && (
            <p className="text-sm text-muted text-center">
              You need an account so you and your driver can track the trip.
            </p>
          )}
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
