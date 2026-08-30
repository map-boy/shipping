import { db } from "./db";

/**
 * Server-owned driver facts, kept apart from `drivers/{id}` because that node is
 * written by the driver's own client on every GPS ping. A driver must never be
 * able to write their own rating, and a position update must never wipe it.
 */
export interface DriverStats {
  activeTripId?: string | null;
  rating?: number;
  ratingCount?: number;
  ratingTotal?: number;
  offersReceived?: number;
  offersAccepted?: number;
  completedTrips?: number;
  onTimeTrips?: number;
}

export const DEFAULT_RATING = 4.5;
export const DEFAULT_ACCEPT_RATE = 0.8;

/** Neither figure means much until a driver has a little history behind it. */
export function ratingOf(stats: DriverStats | undefined): number {
  if (!stats || !stats.ratingCount || stats.ratingCount < 3) return DEFAULT_RATING;
  return typeof stats.rating === "number" ? stats.rating : DEFAULT_RATING;
}

export function acceptRateOf(stats: DriverStats | undefined): number {
  if (!stats || !stats.offersReceived || stats.offersReceived < 5) return DEFAULT_ACCEPT_RATE;
  return (stats.offersAccepted ?? 0) / stats.offersReceived;
}

export async function readAllDriverStats(): Promise<Record<string, DriverStats>> {
  const snap = await db.ref("driverStats").get();
  return (snap.val() || {}) as Record<string, DriverStats>;
}

export async function bumpCounter(driverId: string, field: keyof DriverStats, by = 1) {
  await db
    .ref(`driverStats/${driverId}/${field}`)
    .transaction((n) => (typeof n === "number" ? n + by : by));
}
