import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

interface Props {
  tripId: string;
  amount: number;
  paymentStatus?: string;
}

export default function PaymentButton({ tripId, amount, paymentStatus }: Props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Stop polling once Firestore/RTDB confirms a terminal state
  useEffect(() => {
    if (paymentStatus === "successful" || paymentStatus === "failed") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setRequesting(false);
    }
  }, [paymentStatus]);

  async function handlePay() {
    setError(null);
    if (!phoneNumber) {
      setError("Enter your Mobile Money phone number.");
      return;
    }
    setRequesting(true);

    try {
      const requestMomoPayment = httpsCallable(functions, "requestMomoPayment");
      const result: any = await requestMomoPayment({ phoneNumber, tripId });
      const referenceId = result.data.referenceId;
      pollStatus(referenceId);
    } catch (err: any) {
      setError(err.message || "Payment request failed.");
      setRequesting(false);
    }
  }

  function pollStatus(referenceId: string) {
    const checkMomoPaymentStatus = httpsCallable(functions, "checkMomoPaymentStatus");
    pollRef.current = setInterval(async () => {
      try {
        await checkMomoPaymentStatus({ referenceId, tripId });
        // paymentStatus prop updates via the live trip listener in the parent;
        // the effect above stops polling once it reaches a terminal state.
      } catch {
        // keep polling silently on transient errors
      }
    }, 4000);
  }

  if (paymentStatus === "successful") {
    return <p className="text-green-600 font-medium">Payment received. Thank you!</p>;
  }

  const isPending = paymentStatus === "pending" || requesting;

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <p className="font-medium">Pay {amount} via Mobile Money</p>
      <input
        type="tel"
        placeholder="e.g. 25078XXXXXXX"
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
        className="w-full bg-blue-600 text-white rounded-lg py-3.5 text-base font-semibold disabled:opacity-50 active:bg-blue-700"
      >
        {isPending ? "Waiting..." : "Pay now"}
      </button>
    </div>
  );
}
