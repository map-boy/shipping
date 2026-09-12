import { HttpsError } from "firebase-functions/v2/https";

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export type VehicleType = "standard" | "car_hire" | "bus" | "truck" | "vip";

export const VEHICLE_TYPES: VehicleType[] = ["standard", "car_hire", "bus", "truck", "vip"];

export interface VehicleSpec {
  label: string;
  base: number;
  perKm: number;
  /** Whether this vehicle can carry goods, people, or both. */
  carries: "people" | "goods" | "both";
  maxLoadKg: number | null;
}

export const VEHICLES: Record<VehicleType, VehicleSpec> = {
  standard: { label: "Standard car", base: 500, perKm: 300, carries: "both", maxLoadKg: 50 },
  car_hire: { label: "Small car hire", base: 3000, perKm: 250, carries: "both", maxLoadKg: 100 },
  bus: { label: "Bus", base: 5000, perKm: 450, carries: "both", maxLoadKg: 800 },
  truck: { label: "Truck", base: 1500, perKm: 600, carries: "goods", maxLoadKg: 8000 },
  vip: { label: "VIP car", base: 2500, perKm: 900, carries: "people", maxLoadKg: 50 },
};

// ---------------------------------------------------------------------------
// Bus charter (own pricing model, not part of the generic base+perKm fare)
// ---------------------------------------------------------------------------

/**
 * A bus is chartered as a whole vehicle for the round trip: it drives out and
 * comes back, so the billed distance is always each-way x 2.
 *
 *   up to 50 km each way (100 km round trip):  flat 200,000 RWF
 *   beyond that:  90 RWF x 29 seats x round-trip km
 *
 * Worked example, Kigali - Kayonza at 85 km each way:
 *   170 round-trip km x 29 x 90 = 443,700 RWF
 */
export const BUS_SEATS = 29;

export const BUS_RATE_PER_KM_SEAT = 90;

export const BUS_MINIMUM_RWF = 200_000;

/** The minimum covers anything up to this each-way distance. */
export const BUS_MINIMUM_EACH_WAY_KM = 50;

// ---------------------------------------------------------------------------
// Truck freight (own pricing model, not part of the generic base+perKm fare)
// ---------------------------------------------------------------------------

/**
 * "packaged" = boxed/crated goods billed by their actual weight (soap, steel...).
 * "loose" = non-stackable cargo that takes the whole truck bed regardless of
 * weight (furniture, household items...), so it is billed as a full 30t load.
 */
/**
 * How a truck load is billed.
 *
 *   tonnes: 250,000 + (0.25 x tonnes x km)
 *   tours:  0.25 x tours x km
 *
 * "packaged" and "loose" are the previous names for the same two modes and are
 * still accepted, so trips already in the database keep working.
 */
export type TruckPackage = "tonnes" | "tours";

export const TRUCK_PACKAGES: TruckPackage[] = ["tonnes", "tours"];

const LEGACY_TRUCK_PACKAGES: Record<string, TruckPackage> = {
  packaged: "tonnes",
  loose: "tours",
};

/** Floor charge on a tonnage load; the per-km rate is added on top of it. */
export const TRUCK_PACKAGED_BASE_RWF = 250_000;

// Truck pricing lives in lib/truckPricing.ts - see calculateTruckPrice.

/** One tour is one full truckload, billed as 30 tonnes. */
export const TRUCK_LOOSE_TONNES = 30;

/** Most loads are a single trip out and back. */
export const TRUCK_DEFAULT_TOURS = 1;

export function parseTruckPackage(value: unknown): TruckPackage {
  if (typeof value === "string") {
    if (TRUCK_PACKAGES.includes(value as TruckPackage)) return value as TruckPackage;
    const legacy = LEGACY_TRUCK_PACKAGES[value];
    if (legacy) return legacy;
  }
  throw new HttpsError(
    "invalid-argument",
    `truckPackage must be one of: ${TRUCK_PACKAGES.join(", ")}.`
  );
}

/** Number of truckloads for a load billed by tours. */
export function parseTours(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 100 || !Number.isInteger(n)) {
    throw new HttpsError("invalid-argument", "Number of tours must be a whole number from 1 to 100.");
  }
  return n;
}

export function parseTonnes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > TRUCK_LOOSE_TONNES) {
    throw new HttpsError("invalid-argument", `tonnes must be a number between 0 and ${TRUCK_LOOSE_TONNES}.`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Service classes
// ---------------------------------------------------------------------------

export type ServiceClass = "express" | "first" | "second";

export const SERVICE_CLASSES: ServiceClass[] = ["express", "first", "second"];

export interface ServiceClassSpec {
  label: string;
  /** Delivery window in days, inclusive. minDays 0 means same day. */
  minDays: number;
  maxDays: number;
  /** Applied to the distance-and-vehicle fare. */
  multiplier: number;
  description: string;
}

export const SERVICE_CLASS_SPECS: Record<ServiceClass, ServiceClassSpec> = {
  express: {
    label: "Express",
    minDays: 0,
    maxDays: 1,
    multiplier: 1.6,
    description: "Same day or next day. Dispatched immediately.",
  },
  first: {
    label: "First class",
    minDays: 1,
    maxDays: 3,
    multiplier: 1,
    description: "Delivered within 1 to 3 days.",
  },
  second: {
    label: "Second class",
    minDays: 3,
    maxDays: 7,
    multiplier: 0.75,
    description: "Delivered within 3 to 7 days. Lowest price.",
  },
};

// ---------------------------------------------------------------------------
// Temperature handling
// ---------------------------------------------------------------------------

/** RT = room temperature (ambient). Cold chain splits into chilled and frozen. */
export type Handling = "ambient" | "chilled" | "frozen";

export const HANDLING_TYPES: Handling[] = ["ambient", "chilled", "frozen"];

export interface HandlingSpec {
  label: string;
  multiplier: number;
  /** Target range in Celsius, null for ambient. */
  targetC: [number, number] | null;
  /** Only vehicles flagged for cold chain may carry these. */
  requiresColdChain: boolean;
}

export const HANDLING_SPECS: Record<Handling, HandlingSpec> = {
  ambient: { label: "Room temperature", multiplier: 1, targetC: null, requiresColdChain: false },
  chilled: { label: "Chilled", multiplier: 1.25, targetC: [2, 8], requiresColdChain: true },
  frozen: { label: "Frozen", multiplier: 1.45, targetC: [-25, -15], requiresColdChain: true },
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseVehicleType(value: unknown): VehicleType {
  if (typeof value !== "string" || !VEHICLE_TYPES.includes(value as VehicleType)) {
    throw new HttpsError("invalid-argument", `vehicleType must be one of: ${VEHICLE_TYPES.join(", ")}.`);
  }
  return value as VehicleType;
}

export function parseServiceClass(value: unknown, fallback: ServiceClass = "express"): ServiceClass {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !SERVICE_CLASSES.includes(value as ServiceClass)) {
    throw new HttpsError("invalid-argument", `serviceClass must be one of: ${SERVICE_CLASSES.join(", ")}.`);
  }
  return value as ServiceClass;
}

export function parseHandling(value: unknown, fallback: Handling = "ambient"): Handling {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !HANDLING_TYPES.includes(value as Handling)) {
    throw new HttpsError("invalid-argument", `handling must be one of: ${HANDLING_TYPES.join(", ")}.`);
  }
  return value as Handling;
}

/**
 * Rejects combinations that cannot physically be served, so a rider never pays
 * for a promise no driver can keep.
 */
export function assertServiceable(
  vehicleType: VehicleType,
  tripType: "person" | "goods",
  handling: Handling
) {
  const vehicle = VEHICLES[vehicleType];

  if (tripType === "person" && vehicle.carries === "goods") {
    throw new HttpsError("invalid-argument", `${vehicle.label} does not carry passengers.`);
  }
  if (tripType === "goods" && vehicle.carries === "people") {
    throw new HttpsError("invalid-argument", `${vehicle.label} does not carry goods.`);
  }
  if (tripType === "person" && handling !== "ambient") {
    throw new HttpsError("invalid-argument", "Temperature-controlled transport applies to goods only.");
  }
}

/** When the trip must be delivered by, given its class. */
export function promisedWindow(serviceClass: ServiceClass, from: number) {
  const spec = SERVICE_CLASS_SPECS[serviceClass];
  const day = 24 * 60 * 60 * 1000;
  return {
    promisedFrom: from + spec.minDays * day,
    promisedBy: from + spec.maxDays * day,
  };
}