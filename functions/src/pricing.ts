import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  VEHICLES, SERVICE_CLASS_SPECS, HANDLING_SPECS,
  parseVehicleType, parseServiceClass, parseHandling, assertServiceable, promisedWindow,
  type VehicleType, type ServiceClass, type Handling,
} from "./lib/catalog";
import { distanceKm, round1 } from "./lib/geo";
import { requireLatLng } from "./lib/validate";
import { refreshMarket } from "./marketplace";
import { FALLBACK_SPEED_KMH } from "./lib/constants";

export interface FareBreakdown {
  distanceKm: number;
  durationMin: number;
  vehicleType: VehicleType;
  serviceClass: ServiceClass;
  handling: Handling;
  baseFare: number;
  distanceFare: number;
  subtotal: number;
  serviceMultiplier: number;
  handlingMultiplier: number;
  surgeMultiplier: number;
  price: number;
  currency: "RWF";
  promisedFrom: number;
  promisedBy: number;
}

/** Fares land on a round 10 RWF so drivers and riders see a clean number. */
function roundFare(value: number): number {
  return Math.round(value / 10) * 10;
}

/**
 * The single source of truth for what a trip costs. The client calls quoteFare
 * to display a price and createTrip recomputes with this same function, so the
 * two can never drift apart.
 */
export function computeFare(options: {
  distanceKm: number;
  durationMin?: number;
  vehicleType: VehicleType;
  serviceClass: ServiceClass;
  handling: Handling;
  surgeMultiplier: number;
  at?: number;
}): FareBreakdown {
  const {
    distanceKm: km, vehicleType, serviceClass, handling, surgeMultiplier,
  } = options;

  const vehicle = VEHICLES[vehicleType];
  const service = SERVICE_CLASS_SPECS[serviceClass];
  const handlingSpec = HANDLING_SPECS[handling];

  const durationMin = options.durationMin ?? Math.round((km / FALLBACK_SPEED_KMH) * 60);
  const at = options.at ?? Date.now();

  const baseFare = vehicle.base;
  const distanceFare = km * vehicle.perKm;
  const subtotal = baseFare + distanceFare;

  // Surge only applies to immediate work. A second-class parcel with a seven day
  // window is not competing for a driver right now, so it is not surged.
  const effectiveSurge = serviceClass === "express" ? surgeMultiplier : 1;

  const price = roundFare(subtotal * service.multiplier * handlingSpec.multiplier * effectiveSurge);
  const { promisedFrom, promisedBy } = promisedWindow(serviceClass, at);

  return {
    distanceKm: round1(km),
    durationMin,
    vehicleType,
    serviceClass,
    handling,
    baseFare,
    distanceFare: roundFare(distanceFare),
    subtotal: roundFare(subtotal),
    serviceMultiplier: service.multiplier,
    handlingMultiplier: handlingSpec.multiplier,
    surgeMultiplier: effectiveSurge,
    price,
    currency: "RWF",
    promisedFrom,
    promisedBy,
  };
}

/**
 * Prices every vehicle that can serve the request in one call, so the booking
 * screen shows a real server-computed price per option instead of guessing.
 */
export const quoteFare = onCall(async (request) => {
  const pickup = requireLatLng(request.data?.pickup, "pickup");
  const destination = requireLatLng(request.data?.destination, "destination");
  const tripType = request.data?.tripType === "goods" ? "goods" : "person";
  const serviceClass = parseServiceClass(request.data?.serviceClass, tripType === "person" ? "express" : "first");
  const handling = parseHandling(request.data?.handling);
  const routeKm = request.data?.routeDistanceKm;
  const routeMin = request.data?.routeDurationMin;

  const straightKm = distanceKm(pickup, destination);
  if (straightKm > 500) {
    throw new HttpsError("invalid-argument", "That trip is too long to book here.");
  }

  // Prefer the real road distance the client measured; fall back to great-circle.
  const km =
    typeof routeKm === "number" && Number.isFinite(routeKm) && routeKm >= straightKm * 0.9
      ? routeKm
      : straightKm;
  const durationMin =
    typeof routeMin === "number" && Number.isFinite(routeMin) && routeMin > 0 ? routeMin : undefined;

  // A surge lookup failure must not stop someone getting a price.
  let surgeMultiplier = 1;
  let market = null;
  try {
    market = await refreshMarket(pickup);
    surgeMultiplier = market.surgeMultiplier;
  } catch (err) {
    console.error("surge lookup failed, quoting without surge:", err);
  }

  const quotes = (Object.keys(VEHICLES) as VehicleType[])
    .filter((vehicleType) => {
      try {
        assertServiceable(vehicleType, tripType, handling);
        return true;
      } catch {
        return false;
      }
    })
    .map((vehicleType) => ({
      label: VEHICLES[vehicleType].label,
      maxLoadKg: VEHICLES[vehicleType].maxLoadKg,
      ...computeFare({ distanceKm: km, durationMin, vehicleType, serviceClass, handling, surgeMultiplier }),
    }));

  return {
    quotes,
    serviceClass,
    handling,
    market: market ?? { supply: 0, demand: 0, surgeMultiplier: 1, updatedAt: Date.now() },
  };
});

/** Static catalog so the client never hardcodes prices, labels or windows. */
export const getCatalog = onCall(async () => ({
  vehicles: Object.entries(VEHICLES).map(([value, spec]) => ({ value, ...spec })),
  serviceClasses: Object.entries(SERVICE_CLASS_SPECS).map(([value, spec]) => ({ value, ...spec })),
  handling: Object.entries(HANDLING_SPECS).map(([value, spec]) => ({ value, ...spec })),
}));

export { parseVehicleType, parseServiceClass, parseHandling, assertServiceable };
