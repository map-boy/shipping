import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { TripType } from "../lib/trips";
import type { VehicleType } from "../lib/drivers";

export interface CartItem {
  id: string;
  tripType: TripType;
  vehicleType: VehicleType;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  destinationName: string;
  goodsDescription?: string;
  distanceKm: number;
  price: number;
  addedAt: number;
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "id" | "addedAt">) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  itemCount: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "tiktak-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable, ignore
    }
  }, [items]);

  function addToCart(item: Omit<CartItem, "id" | "addedAt">) {
    const newItem: CartItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedAt: Date.now(),
    };
    setItems((prev) => [...prev, newItem]);
  }

  function removeFromCart(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearCart() {
    setItems([]);
  }

  const itemCount = items.length;
  const totalPrice = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, itemCount, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}