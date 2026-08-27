import { onCall } from "firebase-functions/v2/https";
import { db } from "./lib/db";
import { areaKey, distanceKm, radiusBounds } from "./lib/geo";
import type { LatLng } from "./lib/validate";
import { DRIVER_STALE_AFTER_MS } from "./lib/constants";

/**
 * The two-sided market, measured per area. Supply is drivers who could take a
 * job right now; demand is riders currently waiting for one. Surge reads these
 * two numbers and nothing else.
 */
export interface MarketSnapshot {
  supply: number;
  demand: number;
  surgeMultiplier: number;
  updatedAt: number;
}

const SEARCH_RADIUS_KM = 5;
const MAX_SURGE = 2.5;
const MIN_SURGE = 1;

/** Demand per available driver, mapped onto a multiplier. */
export function surgeFrom(supply: number, demand: number): number {
  if (demand <= 0) return MIN_SURGE;
  if (supply <= 0) return MAX_SURGE;

  const ratio = demand / supply;
  if (ratio <= 1) return MIN_SURGE;

  // Each additional waiting rider per driver adds 30%, capped.
  const raw = 1 + (ratio - 1) * 0.3;
  return Math.min(MAX_SURGE, Math.round(raw * 20) / 20);
}

export async function measureMarket(center: LatLng): Promise<MarketSnapshot> {
  const now = Date.now();
  const bounds = radiusBounds(center, SEARCH_RADIUS_KM);

  const driverSnaps = await Promise.all(
    bounds.map((b) =>
      db.ref("drivers").orderByChild("geohash").startAt(b[0]).endAt(b[1]).get()
    )
  );

  const supplyIds = new Set<string>();
  driverSnaps.forEach((snap) => {
    const val = (snap.val() || {}) as Record<string, {
      lat: number; lng: number; status?: string; lastUpdated?: number; activeTripId?: string | null;
    }>;
    Object.entries(val).forEach(([id, d]) => {
      if (d.status !== "online") return;
      if (d.activeTripId) return;
      if (typeof d.lastUpdated !== "number" || now - d.lastUpdated > DRIVER_STALE_AFTER_MS) return;
      if (distanceKm({ lat: d.lat, lng: d.lng }, center) > SEARCH_RADIUS_KM) return;
      supplyIds.add(id);
    });
  });

  const demandSnap = await db
    .ref("openDemand")
    .orderByChild("areaKey")
    .equalTo(areaKey(center))
    .get();
  const demand = Object.keys(demandSnap.val() || {}).length;

  const supply = supplyIds.size;
  return { supply, demand, surgeMultiplier: surgeFrom(supply, demand), updatedAt: now };
}

/** Caches the snapshot so repeated quotes in the same area do not re-scan. */
export async function refreshMarket(center: LatLng): Promise<MarketSnapshot> {
  const key = areaKey(center);
  const snapshot = await measureMarket(center);
  await db.ref(`marketplace/${key}`).set(snapshot);
  return snapshot;
}

export const marketConditions = onCall(async (request) => {
  const { lat, lng } = request.data ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { supply: 0, demand: 0, surgeMultiplier: 1, updatedAt: Date.now() };
  }
  return await refreshMarket({ lat, lng });
});
