import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

interface Props {
  tripId: string;
  amount: number;
}

export default function PaymentButton({ tripId, amount }: Props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "requesting" | "pending" | "success" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    if (!phoneNumber) {
      setError("Enter your Mobile Money phone number.");
      return;
    }
    setStatus("requesting");

    try {
      const requestMomoPayment = httpsCallable(functions, "requestMomoPayment");
      const result: any = await requestMomoPayment({ phoneNumber, amount, tripId });
      const referenceId = result.data.referenceId;
      setStatus("pending");
      pollStatus(referenceId);
    } catch (err: any) {
      setError(err.message || "Payment request failed.");
      setStatus("failed");
    }
  }

  function pollStatus(referenceId: string) {
    const checkMomoPaymentStatus = httpsCallable(functions, "checkMomoPaymentStatus");
    const interval = setInterval(async () => {
      try {
        const result: any = await checkMomoPaymentStatus({ referenceId, tripId });
        const current = result.data.status;
        if (current === "successful") {
          setStatus("success");
          clearInterval(interval);
        } else if (current === "failed") {
          setStatus("failed");
          clearInterval(interval);
        }
      } catch {
        // keep polling silently on transient errors
      }
    }, 4000);
  }

  if (status === "success") {
    return <p className="text-green-600 font-medium">Payment received. Thank you!</p>;
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <p className="font-medium">Pay {amount} via Mobile Money</p>
      <input
        type="tel"
        placeholder="e.g. 25078XXXXXXX"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="w-full border rounded px-3 py-2"
        disabled={status === "requesting" || status === "pending"}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {status === "pending" && <p className="text-sm text-gray-500">Waiting for confirmation on your phone...</p>}
      <button
        onClick={handlePay}
        disabled={status === "requesting" || status === "pending"}
        className="w-full bg-blue-600 text-white rounded py-2 font-medium disabled:opacity-50"
      >
        {status === "requesting" ? "Requesting..." : status === "pending" ? "Waiting..." : "Pay now"}
      </button>
    </div>
  );
}

