import { useState, useEffect, useRef, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useToast } from "../context/toast";
import type { PaymentStatus } from "../lib/trips";

interface Props {
  tripId: string;
  amount: number;
  paymentStatus?: PaymentStatus;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("250")) return digits;
  if (digits.startsWith("0")) return "250" + digits.slice(1);
  if (digits.startsWith("7")) return "250" + digits;
  return digits;
}

export default function PaymentButton({ tripId, amount, paymentStatus }: Props) {
  const { showToast } = useToast();
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

  // The server reads the reference id off the trip itself, so the client never
  // has to hold or replay it.
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    const checkMomoPaymentStatus = httpsCallable<{ tripId: string }, { status: string }>(
      functions,
      "checkMomoPaymentStatus"
    );
    pollRef.current = setInterval(() => {
      checkMomoPaymentStatus({ tripId }).catch(() => {
        // transient network / MoMo hiccup - the next tick tries again
      });
    }, 4000);
  }, [tripId]);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (paymentStatus === "pending") {
      // Covers a reload in the middle of a payment as well as a fresh request.
      startPolling();
    } else if (paymentStatus === "successful" || paymentStatus === "failed") {
      stopPolling();
    }

    if (paymentStatus !== prevStatusRef.current) {
      if (paymentStatus === "successful") {
        showToast("Payment received. Thank you!", "success");
      } else if (paymentStatus === "failed") {
        showToast("Payment failed. Please try again.", "error");
      }
      prevStatusRef.current = paymentStatus;
    }
  }, [paymentStatus, showToast, startPolling, stopPolling]);

  async function handlePay() {
    setError(null);
    if (!phoneNumber.trim()) {
      setError("Enter your Mobile Money phone number.");
      showToast("Enter your Mobile Money phone number.", "error");
      return;
    }
    setRequested(true);

    try {
      const requestMomoPayment = httpsCallable<{ phoneNumber: string; tripId: string }, { referenceId: string }>(
        functions,
        "requestMomoPayment"
      );
      await requestMomoPayment({ phoneNumber: normalizePhone(phoneNumber), tripId });
      showToast("Payment request sent. Check your phone to confirm.", "info");
      startPolling();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Payment request failed.";
      setError(message);
      showToast(message, "error");
      setRequested(false);
    }
  }

  if (paymentStatus === "successful") {
    return <p className="text-green-600 font-medium text-center">Payment received. Thank you!</p>;
  }

  const isPending = paymentStatus === "pending" || (requested && paymentStatus !== "failed");

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <p className="font-medium">Pay {amount.toLocaleString()} RWF via Mobile Money</p>
      <input
        type="tel"
        inputMode="tel"
        placeholder="e.g. 0781234567"
        aria-label="Mobile Money phone number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="w-full border rounded-lg px-3 py-3 text-base"
        disabled={isPending}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {paymentStatus === "failed" && (
        <p className="text-red-600 text-sm">Payment failed. Please try again.</p>
      )}
      {isPending && <p className="text-sm text-gray-500">Waiting for confirmation on your phone...</p>}
      <button
        onClick={handlePay}
        disabled={isPending}
        className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-blue-700 flex items-center justify-center gap-2"
      >
        {isPending && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isPending ? "Waiting..." : "Pay now"}
      </button>
    </div>
  );
}
