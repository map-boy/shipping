import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CartContext, type CartItem } from "../context/cart";

const STORAGE_KEY = "tiktak-cart";

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStoredCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable (private mode, quota) - the cart just won't survive a reload
    }
  }, [items]);

  const addToCart = useCallback((item: Omit<CartItem, "id" | "addedAt">) => {
    setItems((prev) => [
      ...prev,
      { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, addedAt: Date.now() },
    ]);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      clearCart,
      itemCount: items.length,
      totalPrice: items.reduce((sum, i) => sum + i.price, 0),
    }),
    [items, addToCart, removeFromCart, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
