import { distanceBetween } from "geofire-common";
import type { VehicleType } from "./drivers";

interface FareConfig {
  base: number;
  perKm: number;
}

const FARE_TABLE: Record<VehicleType, FareConfig> = {
  standard: { base: 500, perKm: 300 },
  truck: { base: 1500, perKm: 600 },
  vip: { base: 2500, perKm: 900 },
};

export interface FareEstimate {
  distanceKm: number;
  price: number;
}

export function estimateFare(
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  vehicleType: VehicleType
): FareEstimate {
  const distanceKm = distanceBetween(
    [pickup.lat, pickup.lng],
    [destination.lat, destination.lng]
  );
  const { base, perKm } = FARE_TABLE[vehicleType];
  const price = Math.round(base + distanceKm * perKm);
  return { distanceKm: Math.round(distanceKm * 10) / 10, price };
}