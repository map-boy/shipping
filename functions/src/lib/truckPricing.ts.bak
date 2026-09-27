import { HttpsError } from "firebase-functions/v2/https";

/**
 * The single place a truck price is calculated.
 *
 * Written in exactly the form the tariff was given, so it can be checked against
 * the spec line by line rather than mentally re-derived:
 *
 *   by tonnes: 250,000 + (0.25 x distanceKm x 1,000 x tonnes)
 *   by tours:  0.25 x distanceKm x numberOfTours x 30,000
 *
 * Nothing else may compute a truck price. quoteTruckFare and createTrip both
 * call this, and the client never calculates at all - it displays the `formula`
 * string returned here, so what the customer reads is literally the arithmetic
 * that produced the number they are charged.
 */

export type TruckPricingMethod = "tonnes" | "tours";

export const TRUCK_BASE_PRICE_RWF = 250_000;
export const TRUCK_RATE = 0.25;
/** Tonnage is billed per 1,000 units of the rate. */
export const TRUCK_TONNE_UNIT = 1_000;
/** A tour is one full truckload, billed at 30,000 units of the rate. */
export const TRUCK_TOUR_UNIT = 30_000;

export interface TruckPriceResult {
  price: number;
  /** The arithmetic actually performed, with the real values substituted in. */
  formula: string;
  pricingMethod: TruckPricingMethod;
  distanceKm: number;
  tonnes: number;
  numberOfTours: number;
}

/** Accepts numbers or numeric strings; rejects anything that is not a real number. */
function toNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) {
    throw new HttpsError("invalid-argument", `${field} must be a number.`);
  }
  return n;
}

function requirePositive(value: unknown, field: string): number {
  const n = toNumber(value, field);
  if (n <= 0) {
    throw new HttpsError("invalid-argument", `${field} must be greater than zero.`);
  }
  return n;
}

export function calculateTruckPrice(input: {
  pricingMethod: TruckPricingMethod;
  distanceKm: unknown;
  tonnes?: unknown;
  numberOfTours?: unknown;
}): TruckPriceResult {
  const { pricingMethod } = input;

  if (pricingMethod !== "tonnes" && pricingMethod !== "tours") {
    throw new HttpsError("invalid-argument", "pricingMethod must be 'tonnes' or 'tours'.");
  }

  const distanceKm = requirePositive(input.distanceKm, "Distance");

  if (pricingMethod === "tonnes") {
    const tonnes = requirePositive(input.tonnes, "Tonnes");

    // 250,000 + (0.25 x km x 1,000 x tonnes)
    const price = TRUCK_BASE_PRICE_RWF + TRUCK_RATE * distanceKm * TRUCK_TONNE_UNIT * tonnes;

    return {
      price,
      formula:
        `${TRUCK_BASE_PRICE_RWF.toLocaleString()} + ` +
        `(${TRUCK_RATE} x ${distanceKm} km x ${TRUCK_TONNE_UNIT.toLocaleString()} x ${tonnes} t) = ` +
        `${price.toLocaleString()} RWF`,
      pricingMethod,
      distanceKm,
      tonnes,
      numberOfTours: 0,
    };
  }

  const numberOfTours = requirePositive(input.numberOfTours, "Number of tours");
  if (!Number.isInteger(numberOfTours)) {
    throw new HttpsError("invalid-argument", "Number of tours must be a whole number.");
  }

  // 0.25 x km x tours x 30,000
  const price = TRUCK_RATE * distanceKm * numberOfTours * TRUCK_TOUR_UNIT;

  return {
    price,
    formula:
      `${TRUCK_RATE} x ${distanceKm} km x ${numberOfTours} tour${numberOfTours === 1 ? "" : "s"} x ` +
      `${TRUCK_TOUR_UNIT.toLocaleString()} = ${price.toLocaleString()} RWF`,
    pricingMethod,
    distanceKm,
    tonnes: 0,
    numberOfTours,
  };
}
