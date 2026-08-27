import { geohashForLocation, geohashQueryBounds, distanceBetween } from "geofire-common";
import type { LatLng } from "./validate";

/** Area key used to aggregate marketplace supply and demand. ~5km cells. */
export const AREA_PRECISION = 5;

export function geohash(point: LatLng): string {
  return geohashForLocation([point.lat, point.lng]);
}

export function areaKey(point: LatLng): string {
  return geohash(point).slice(0, AREA_PRECISION);
}

export function distanceKm(a: LatLng, b: LatLng): number {
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]);
}

export function radiusBounds(center: LatLng, radiusKm: number): string[][] {
  return geohashQueryBounds([center.lat, center.lng], radiusKm * 1000);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
