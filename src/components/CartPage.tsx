import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/cart";
import { createTripRequest } from "../lib/trips";
import { auth } from "../firebase";
import { useToast } from "../context/toast";

export default function CartPage() {
  const { items, removeFromCart, clearCart, totalPrice } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [checkingOut, setCheckingOut] = useState(false);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-3">Your cart is empty</h1>
        <p className="text-gray-500 mb-6">Add a ride or goods request to get started.</p>
        <Link to="/ride" className="inline-block bg-cta text-white px-6 py-3 rounded-xl font-medium">
          Book a ride
        </Link>
      </div>
    );
  }

  async function handleCheckout() {
    if (!auth.currentUser) {
      showToast("Please log in first.", "error");
      return;
    }
    setCheckingOut(true);
    try {
      let firstTripId: string | null = null;
      for (const item of items) {
        const tripId = await createTripRequest(
          item.tripType,
          item.vehicleType,
          item.pickup,
          item.destination,
          item.goodsDescription
        );
        if (!firstTripId) firstTripId = tripId;
      }
      clearCart();
      showToast(
        items.length > 1 ? "Requests sent! Tracking your first trip." : "Ride requested!",
        "success"
      );
      navigate("/ride", { state: { tripId: firstTripId } });
    } catch (err) {
      showToast(
        err instanceof Error && err.message ? err.message : "Could not complete checkout. Please try again.",
        "error"
      );
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Your cart</h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="border rounded-2xl p-4 flex justify-between items-start">
            <div>
              <p className="font-medium capitalize">
                {item.tripType} · {item.vehicleType}
              </p>
              <p className="text-sm text-gray-500">{item.destinationName}</p>
              {item.goodsDescription && (
                <p className="text-sm text-gray-500">Goods: {item.goodsDescription}</p>
              )}
              <p className="text-sm text-gray-400">{item.distanceKm.toFixed(1)} km</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{item.price.toLocaleString()} RWF</p>
              <button
                onClick={() => removeFromCart(item.id)}
                className="text-sm text-red-500 mt-2"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 border-t pt-4">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-lg font-semibold">{totalPrice.toLocaleString()} RWF</span>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => clearCart()}
          disabled={checkingOut}
          className="flex-1 border rounded-xl py-3 font-medium disabled:opacity-50"
        >
          Clear cart
        </button>
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="flex-1 bg-cta text-white rounded-xl py-3 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {checkingOut && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {checkingOut ? "Requesting..." : "Checkout"}
        </button>
      </div>
    </div>
  );
}