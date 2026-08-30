import { createContext, useContext } from "react";
import type { Handling, ServiceClass, TripType, VehicleType } from "../lib/catalog";

export interface CartItem {
  id: string;
  tripType: TripType;
  vehicleType: VehicleType;
  serviceClass: ServiceClass;
  handling: Handling;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  destinationName: string;
  goodsDescription?: string;
  distanceKm: number;
  price: number;
  promisedBy: number;
  addedAt: number;
}

export interface CartContextValue {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "id" | "addedAt">) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  itemCount: number;
  totalPrice: number;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
