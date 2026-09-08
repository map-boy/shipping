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

/**
 * Rwandan mobile numbers, normalised to full MSISDN (2507XXXXXXXX). Accepts the
 * forms people actually type: 078..., 78..., +250 78..., with or without spaces.
 */
export function normalizeRwandaMsisdn(raw: unknown, field = "phone number"): string {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  const msisdn = digits.startsWith("250")
    ? digits
    : digits.startsWith("0")
    ? `250${digits.slice(1)}`
    : digits.startsWith("7")
    ? `250${digits}`
    : digits;
  if (!/^2507[0-9]{8}$/.test(msisdn)) {
    throw new HttpsError("invalid-argument", `Enter a valid Rwandan ${field}, e.g. 0781234567.`);
  }
  return msisdn;
}

/** A person's name as typed, trimmed and bounded. */
export function requirePersonName(value: unknown, field: string): string {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) {
    throw new HttpsError("invalid-argument", `${field} must be between 2 and 120 characters.`);
  }
  return name;
}
