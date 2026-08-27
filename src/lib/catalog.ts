/**
 * Client mirror of the server catalog. Labels and windows are safe to show from
 * here; prices are never computed client-side - quoteFare is the only source.
 */

export type VehicleType = "standard" | "car_hire" | "bus" | "truck" | "vip";
export type ServiceClass = "express" | "first" | "second";
export type Handling = "ambient" | "chilled" | "frozen";
export type TripType = "person" | "goods";

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  standard: "Standard car",
  car_hire: "Small car hire",
  bus: "Bus",
  truck: "Truck",
  vip: "VIP car",
};

export const VEHICLE_CARRIES: Record<VehicleType, "people" | "goods" | "both"> = {
  standard: "both",
  car_hire: "both",
  bus: "both",
  truck: "goods",
  vip: "people",
};

export const SERVICE_CLASSES: {
  value: ServiceClass;
  label: string;
  window: string;
  description: string;
}[] = [
  { value: "express", label: "Express", window: "Same day", description: "Dispatched to a driver right now." },
  { value: "first", label: "First class", window: "1-3 days", description: "Collected and delivered within three days." },
  { value: "second", label: "Second class", window: "3-7 days", description: "Lowest price, delivered within a week." },
];

export const HANDLING_OPTIONS: {
  value: Handling;
  label: string;
  detail: string;
}[] = [
  { value: "ambient", label: "Room temperature", detail: "Standard handling" },
  { value: "chilled", label: "Chilled", detail: "Kept between 2 and 8 C" },
  { value: "frozen", label: "Frozen", detail: "Kept between -25 and -15 C" },
];

export function canCarry(vehicleType: VehicleType, tripType: TripType): boolean {
  const carries = VEHICLE_CARRIES[vehicleType];
  if (carries === "both") return true;
  return tripType === "person" ? carries === "people" : carries === "goods";
}

export function formatRwf(amount: number): string {
  return `${amount.toLocaleString()} RWF`;
}
