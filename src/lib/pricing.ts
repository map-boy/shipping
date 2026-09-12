import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { Handling, ServiceClass, TripType, VehicleType, TruckPackage } from "./catalog";

export interface FareQuote {
  vehicleType: VehicleType;
  label: string;
  maxLoadKg: number | null;
  distanceKm: number;
  durationMin: number;
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
  /** Present only on truck quotes: the arithmetic the server performed. */
  formula?: string;
  /** Present only on bus quotes, which are whole-vehicle round-trip charters. */
  seats?: number;
  ratePerKmSeat?: number;
  eachWayKm?: number;
  billableKm?: number;
  roundTrip?: true;
  minimumApplied?: boolean;
}

export interface MarketSnapshot {
  supply: number;
  demand: number;
  surgeMultiplier: number;
  updatedAt: number;
}

export interface QuoteRequest {
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  tripType: TripType;
  serviceClass: ServiceClass;
  handling: Handling;
  routeDistanceKm?: number;
  routeDurationMin?: number;
}

/**
 * The server prices every vehicle that can serve this request. Nothing about the
 * fare is calculated on the client, so what is shown is always what is charged.
 */
export async function quoteFare(req: QuoteRequest): Promise<{
  quotes: FareQuote[];
  market: MarketSnapshot;
}> {
  const fn = httpsCallable<QuoteRequest, { quotes: FareQuote[]; market: MarketSnapshot }>(
    functions,
    "quoteFare"
  );
  const result = await fn(req);
  return result.data;
}

export interface TruckFareQuote {
  vehicleType: "truck";
  /** The arithmetic the server performed, shown to the customer verbatim. */
  formula: string;
  distanceKm: number;
  durationMin: number;
  truckPackage: TruckPackage;
  tonnes: number;
  tours: number;
  baseFare: number;
  distanceFare: number;
  price: number;
  currency: "RWF";
  promisedFrom: number;
  promisedBy: number;
}

export interface TruckQuoteRequest {
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  truckPackage: TruckPackage;
  tonnes?: number;
  tours?: number;
  routeDistanceKm?: number;
  routeDurationMin?: number;
}

/**
 * Truck freight has its own formula and its own callable - see
 * computeTruckFare on the server. No auth required, so this can be called
 * from a no-login quick-book form.
 */
export async function quoteTruckFare(req: TruckQuoteRequest): Promise<TruckFareQuote> {
  const fn = httpsCallable<TruckQuoteRequest, TruckFareQuote>(functions, "quoteTruckFare");
  const result = await fn(req);
  return result.data;
}
export interface BusFareQuote extends FareQuote {
  vehicleType: "bus";
  seats: number;
  ratePerKmSeat: number;
  eachWayKm: number;
  billableKm: number;
  roundTrip: true;
  minimumApplied: boolean;
}

/** Standalone bus charter quote. Priced as a round trip: each-way distance x 2. */
export async function quoteBusFare(req: {
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  routeDistanceKm?: number;
  routeDurationMin?: number;
}): Promise<BusFareQuote> {
  const fn = httpsCallable<typeof req, BusFareQuote>(functions, "quoteBusFare");
  const result = await fn(req);
  return result.data;
}
