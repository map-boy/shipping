import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  VEHICLES, SERVICE_CLASS_SPECS, HANDLING_SPECS,
  parseVehicleType, parseServiceClass, parseHandling, assertServiceable, promisedWindow,
  parseTruckPackage, parseTonnes, parseTours, TRUCK_PACKAGED_BASE_RWF, TRUCK_RATE_PER_KM_TONNE,
  TRUCK_DEFAULT_TOURS, TRUCK_LOOSE_TONNES,
  BUS_SEATS, BUS_RATE_PER_KM_SEAT, BUS_MINIMUM_RWF, BUS_MINIMUM_EACH_WAY_KM,
  type VehicleType, type ServiceClass, type Handling, type TruckPackage,
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

export interface TruckFareBreakdown extends FareBreakdown {
  truckPackage: TruckPackage;
  /** Truckloads, when billing by tours. 1 for a tonnage load. */
  tours: number;
  tonnes: number;
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

export interface BusFareBreakdown extends FareBreakdown {
  seats: number;
  ratePerKmSeat: number;
  /** One-way road distance between pickup and destination. */
  eachWayKm: number;
  /** What is actually billed: the bus drives out and back, so each-way x 2. */
  billableKm: number;
  roundTrip: true;
  minimumApplied: boolean;
}

/**
 * Bus charter. The whole vehicle is hired for the round trip, so the billed
 * distance is each-way x 2 and the seat count is the bus capacity rather than
 * however many people actually travel.
 *
 *   round trip <= 100 km:  flat 200,000 RWF
 *   beyond that:           90 x 29 x round-trip km
 *
 * Service class, temperature and surge do not apply: this is a quoted charter
 * rate, not metered work competing for a driver right now.
 */
export function computeBusFare(options: {
  distanceKm: number;
  durationMin?: number;
  at?: number;
}): BusFareBreakdown {
  const eachWayKm = round1(options.distanceKm);
  const billableKm = round1(eachWayKm * 2);

  const metered = BUS_RATE_PER_KM_SEAT * BUS_SEATS * billableKm;
  const withinMinimum = eachWayKm <= BUS_MINIMUM_EACH_WAY_KM;

  // The floor is applied above the threshold too, so a future rate change can
  // never quote a charter below the agreed minimum.
  const price = withinMinimum ? BUS_MINIMUM_RWF : Math.max(BUS_MINIMUM_RWF, roundFare(metered));

  const durationMin = options.durationMin ?? Math.round((eachWayKm / FALLBACK_SPEED_KMH) * 60);
  const at = options.at ?? Date.now();
  const { promisedFrom, promisedBy } = promisedWindow("express", at);

  return {
    distanceKm: eachWayKm,
    durationMin,
    vehicleType: "bus",
    serviceClass: "express",
    handling: "ambient",
    baseFare: withinMinimum ? BUS_MINIMUM_RWF : 0,
    distanceFare: withinMinimum ? 0 : roundFare(metered),
    subtotal: price,
    serviceMultiplier: 1,
    handlingMultiplier: 1,
    surgeMultiplier: 1,
    price,
    currency: "RWF",
    promisedFrom,
    promisedBy,
    seats: BUS_SEATS,
    ratePerKmSeat: BUS_RATE_PER_KM_SEAT,
    eachWayKm,
    billableKm,
    roundTrip: true,
    minimumApplied: withinMinimum,
  };
}

/**
 * Truck freight, billed one of two ways:
 *
 *   tonnes: 250,000 + (0.25 x tonnes x km)
 *   tours:  0.25 x tours x km x 30   (a tour fills the whole truck: TRUCK_LOOSE_TONNES)
 *
 * Always immediate and ambient - trucks are not offered a delivery window or
 * temperature control.
 */
export function computeTruckFare(options: {
  distanceKm: number;
  durationMin?: number;
  truckPackage: TruckPackage;
  tonnes?: number;
  tours?: number;
  at?: number;
}): TruckFareBreakdown {
  const { distanceKm: km, truckPackage } = options;
  const byTours = truckPackage === "tours";

  const tours = byTours ? options.tours ?? TRUCK_DEFAULT_TOURS : 1;
  const tonnes = byTours ? 0 : options.tonnes ?? 0;

  const units = byTours ? tours * TRUCK_LOOSE_TONNES : tonnes;
  const distanceFare = km * units * TRUCK_RATE_PER_KM_TONNE;
  const baseFare = byTours ? 0 : TRUCK_PACKAGED_BASE_RWF;
  const price = baseFare + distanceFare;

  const durationMin = options.durationMin ?? Math.round((km / FALLBACK_SPEED_KMH) * 60);
  const at = options.at ?? Date.now();
  const { promisedFrom, promisedBy } = promisedWindow("express", at);

  return {
    distanceKm: round1(km),
    durationMin,
    vehicleType: "truck",
    serviceClass: "express",
    handling: "ambient",
    baseFare,
    distanceFare,
    subtotal: price,
    serviceMultiplier: 1,
    handlingMultiplier: 1,
    surgeMultiplier: 1,
    price,
    currency: "RWF",
    promisedFrom,
    promisedBy,
    truckPackage,
    tonnes,
    tours,
  };
}

/**
 * Prices every vehicle that can serve the request in one call, so the booking
 * screen shows a real server-computed price per option instead of guessing.
 * Truck is excluded here - it has its own quoteTruckFare below, since it needs
 * a package type and tonnage the generic quote request does not carry.
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
    .filter((vehicleType) => vehicleType !== "truck")
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
      // Bus is a whole-vehicle round-trip charter, so it is priced by its own
      // tariff even when it appears alongside metered vehicles.
      ...(vehicleType === "bus"
        ? computeBusFare({ distanceKm: km, durationMin })
        : computeFare({ distanceKm: km, durationMin, vehicleType, serviceClass, handling, surgeMultiplier })),
    }));

  return {
    quotes,
    serviceClass,
    handling,
    market: market ?? { supply: 0, demand: 0, surgeMultiplier: 1, updatedAt: Date.now() },
  };
});

/** Standalone bus charter quote: pickup and destination, priced as a round trip. */
export const quoteBusFare = onCall(async (request) => {
  const pickup = requireLatLng(request.data?.pickup, "pickup");
  const destination = requireLatLng(request.data?.destination, "destination");

  const straightKm = distanceKm(pickup, destination);
  if (straightKm > 500) {
    throw new HttpsError("invalid-argument", "That trip is too long to book here.");
  }

  const routeKm = request.data?.routeDistanceKm;
  const km =
    typeof routeKm === "number" && Number.isFinite(routeKm) && routeKm >= straightKm * 0.9
      ? routeKm
      : straightKm;
  const routeMin = request.data?.routeDurationMin;
  const durationMin =
    typeof routeMin === "number" && Number.isFinite(routeMin) && routeMin > 0 ? routeMin : undefined;

  return { ...computeBusFare({ distanceKm: km, durationMin }), vehicleType: "bus" as const };
});

/**
 * Standalone truck freight quote: pickup, destination, package type and
 * tonnage in, one price out. No auth required - this is meant to be callable
 * from a no-login quick-book form.
 */
export const quoteTruckFare = onCall(async (request) => {
  const pickup = requireLatLng(request.data?.pickup, "pickup");
  const destination = requireLatLng(request.data?.destination, "destination");
  const truckPackage = parseTruckPackage(request.data?.truckPackage);
  const byTours = truckPackage === "tours";
  const tonnes = byTours ? undefined : parseTonnes(request.data?.tonnes);
  const tours = byTours ? parseTours(request.data?.tours) : undefined;
  const routeKm = request.data?.routeDistanceKm;
  const routeMin = request.data?.routeDurationMin;

  const straightKm = distanceKm(pickup, destination);
  if (straightKm > 500) {
    throw new HttpsError("invalid-argument", "That trip is too long to book here.");
  }

  const km =
    typeof routeKm === "number" && Number.isFinite(routeKm) && routeKm >= straightKm * 0.9
      ? routeKm
      : straightKm;
  const durationMin =
    typeof routeMin === "number" && Number.isFinite(routeMin) && routeMin > 0 ? routeMin : undefined;

  const fare = computeTruckFare({ distanceKm: km, durationMin, truckPackage, tonnes, tours });
  return { ...fare, vehicleType: "truck" as const };
});

/** Static catalog so the client never hardcodes prices, labels or windows. */
export const getCatalog = onCall(async () => ({
  vehicles: Object.entries(VEHICLES).map(([value, spec]) => ({ value, ...spec })),
  serviceClasses: Object.entries(SERVICE_CLASS_SPECS).map(([value, spec]) => ({ value, ...spec })),
  handling: Object.entries(HANDLING_SPECS).map(([value, spec]) => ({ value, ...spec })),
}));

export { parseVehicleType, parseServiceClass, parseHandling, assertServiceable };