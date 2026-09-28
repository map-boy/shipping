import { useState, useEffect, useRef, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useToast } from "../context/toast";
import type { PaymentStatus } from "../lib/trips";
import { useLang } from "../i18n/context";

interface Props {
  tripId: string;
  amount: number;
  paymentStatus?: PaymentStatus;
  paymentProvider?: string;
}

type Method = "mobile" | "card";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("250")) return digits;
  if (digits.startsWith("0")) return "250" + digits.slice(1);
  if (digits.startsWith("7")) return "250" + digits;
  return digits;
}

export default function PaymentButton({ tripId, amount, paymentStatus, paymentProvider }: Props) {
  const { showToast } = useToast();
  const { t } = useLang();
  const [method, setMethod] = useState<Method>("mobile");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<PaymentStatus | undefined>(paymentStatus);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // IntouchPay settles through its server callback and the trip updates live, so
  // only card (DPO) and the older MTN-direct flow need to be asked about.
  const startPolling = useCallback(
    (provider?: string) => {
      if (provider === "intouch" || pollRef.current) return;
      const name = provider === "dpo" ? "verifyDpoPayment" : "checkMomoPaymentStatus";
      const check = httpsCallable<{ tripId: string }, { status: string }>(functions, name);
      pollRef.current = setInterval(() => {
        check({ tripId }).catch(() => {
          // transient network hiccup - the next tick tries again
        });
      }, 4000);
    },
    [tripId]
  );

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (paymentStatus === "pending") {
      startPolling(paymentProvider);
    } else if (paymentStatus === "successful" || paymentStatus === "failed") {
      stopPolling();
    }

    if (paymentStatus !== prevStatusRef.current) {
      if (paymentStatus === "successful") {
        showToast(t("pay.received"), "success");
      } else if (paymentStatus === "failed") {
        showToast(t("pay.failed"), "error");
      }
      prevStatusRef.current = paymentStatus;
    }
  }, [paymentStatus, paymentProvider, showToast, startPolling, stopPolling, t]);

  async function handleMobilePay() {
    setError(null);
    if (!phoneNumber.trim()) {
      setError(t("pay.enter_phone"));
      showToast(t("pay.enter_phone"), "error");
      return;
    }
    setRequested(true);
    try {
      const request = httpsCallable<{ phoneNumber: string; tripId: string }, { ok: boolean }>(
        functions,
        "requestIntouchPayment"
      );
      await request({ phoneNumber: normalizePhone(phoneNumber), tripId });
      showToast(t("pay.sent"), "info");
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t("pay.req_fail");
      setError(message);
      showToast(message, "error");
      setRequested(false);
    }
  }

  async function handleCardPay() {
    setError(null);
    setRequested(true);
    try {
      const create = httpsCallable<{ tripId: string }, { payUrl: string }>(functions, "createDpoPayment");
      const res = await create({ tripId });
      window.location.assign(res.data.payUrl);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : t("pay.card_fail");
      setError(message);
      showToast(message, "error");
      setRequested(false);
    }
  }

  if (paymentStatus === "successful") {
    return <p className="text-center text-base font-semibold">{t("pay.received")}</p>;
  }

  const isPending = paymentStatus === "pending" || (requested && paymentStatus !== "failed");

  return (
    <div className="space-y-3">
      <p className="eyebrow">{t("pay.title")}</p>
      <div className="flex gap-2">
        {(["mobile", "card"] as Method[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={isPending}
            onClick={() => setMethod(m)}
            className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
              method === m ? "border-ink bg-white text-ink" : "border-transparent bg-white/60 text-muted"
            }`}
          >
            {m === "mobile" ? t("pay.mobile") : t("pay.card")}
          </button>
        ))}
      </div>

      {method === "mobile" && (
        <input
          type="tel"
          inputMode="tel"
          placeholder={t("pay.phone_ph")}
          aria-label={t("pay.phone_aria")}
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="field"
          disabled={isPending}
        />
      )}
      {method === "card" && (
        <p className="text-sm text-muted">{t("pay.card_info")}</p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {paymentStatus === "failed" && (
        <p className="text-red-600 text-sm">{t("pay.failed")}</p>
      )}
      {isPending && (
        <p className="text-sm text-muted">
          {paymentProvider === "dpo" ? t("pay.wait_card") : t("pay.check_phone")}
        </p>
      )}
      <button
        onClick={method === "mobile" ? handleMobilePay : handleCardPay}
        disabled={isPending}
        className="btn-primary"
      >
        {isPending && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isPending ? t("pay.waiting") : t("pay.pay", { amount: amount.toLocaleString() })}
      </button>
    </div>
  );
}