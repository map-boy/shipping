import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/cart";
import { createTripRequest } from "../lib/trips";
import { auth } from "../firebase";
import { useToast } from "../context/toast";
import { useLang } from "../i18n/context";
import type { MsgKey } from "../i18n/messages";

export default function CartPage() {
  const { items, removeFromCart, clearCart, totalPrice } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLang();
  const [checkingOut, setCheckingOut] = useState(false);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-3">{t("cart.empty")}</h1>
        <p className="text-gray-500 mb-6">{t("cart.empty_sub")}</p>
        <Link to="/ride" className="inline-block bg-cta text-white px-6 py-3 rounded-xl font-medium">
          {t("cart.book_ride")}
        </Link>
      </div>
    );
  }

  async function handleCheckout() {
    if (!auth.currentUser) {
      showToast(t("ride.login_first"), "error");
      return;
    }
    setCheckingOut(true);
    try {
      let firstTripId: string | null = null;
      for (const item of items) {
        const tripId = await createTripRequest({
          tripType: item.tripType,
          vehicleType: item.vehicleType,
          serviceClass: item.serviceClass,
          handling: item.handling,
          pickup: item.pickup,
          destination: item.destination,
          goodsDescription: item.goodsDescription,
          routeDistanceKm: item.distanceKm,
        });
        if (!firstTripId) firstTripId = tripId;
      }
      clearCart();
      showToast(
        items.length > 1 ? t("cart.sent_many") : t("cart.sent_one"),
        "success"
      );
      navigate("/ride", { state: { tripId: firstTripId } });
    } catch (err) {
      showToast(
        err instanceof Error && err.message ? err.message : t("cart.fail"),
        "error"
      );
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">{t("cart.title")}</h1>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="border rounded-2xl p-4 flex justify-between items-start">
            <div>
              <p className="font-medium capitalize">
                {t(`tt.${item.tripType}` as MsgKey)} &middot; {t(`vehicle.${item.vehicleType}` as MsgKey)}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {t(`sc.${item.serviceClass}.label` as MsgKey)}
                {item.handling !== "ambient" ? " \u00b7 " + t(`hd.${item.handling}.label` as MsgKey) : ""}
              </p>
              <p className="text-sm text-gray-500">{item.destinationName}</p>
              {item.goodsDescription && (
                <p className="text-sm text-gray-500">{t("cart.goods", { desc: item.goodsDescription })}</p>
              )}
              <p className="text-sm text-gray-400">{item.distanceKm.toFixed(1)} km</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{item.price.toLocaleString()} RWF</p>
              <button
                onClick={() => removeFromCart(item.id)}
                className="text-sm text-red-500 mt-2"
              >
                {t("cart.remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 border-t pt-4">
        <span className="text-lg font-semibold">{t("cart.total")}</span>
        <span className="text-lg font-semibold">{totalPrice.toLocaleString()} RWF</span>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => clearCart()}
          disabled={checkingOut}
          className="flex-1 border rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {t("cart.clear")}
        </button>
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="flex-1 bg-cta text-white rounded-xl py-3 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {checkingOut && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {checkingOut ? t("cart.requesting") : t("cart.checkout")}
        </button>
      </div>
    </div>
  );
}