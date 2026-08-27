import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export type VehicleType = "standard" | "truck" | "vip";
export const VEHICLE_TYPES: VehicleType[] = ["standard", "truck", "vip"];

export interface LatLng {
  lat: number;
  lng: number;
}

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  return request.auth.uid;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return value.trim();
}

export function requireVehicleType(value: unknown): VehicleType {
  if (typeof value !== "string" || !VEHICLE_TYPES.includes(value as VehicleType)) {
    throw new HttpsError("invalid-argument", "Unknown vehicleType.");
  }
  return value as VehicleType;
}

export function isLatLng(value: unknown): value is LatLng {
  const p = value as { lat?: unknown; lng?: unknown } | null;
  return (
    !!p &&
    typeof p.lat === "number" && Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && p.lng >= -180 && p.lng <= 180
  );
}

export function requireLatLng(value: unknown, field: string): LatLng {
  if (!isLatLng(value)) {
    throw new HttpsError("invalid-argument", `${field} must be valid coordinates.`);
  }
  return { lat: value.lat, lng: value.lng };
}
