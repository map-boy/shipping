import { onValueCreated } from "firebase-functions/v2/database";
import { db } from "./lib/db";
import type { TripEvent } from "./lib/events";

/**
 * One event fans out to several independent consumers. The trip flow does not
 * call notifications, receipts or analytics itself and does not wait for them -
 * it writes a milestone and returns. Each consumer below fails on its own
 * without blocking the others or the trip.
 */
export const onTripEvent = onValueCreated("/tripEvents/{tripId}/{eventId}", async (event) => {
  const tripId = event.params.tripId;
  const value = event.data.val() as TripEvent | null;
  if (!value?.type) return;

  const results = await Promise.allSettled([
    notifyConsumer(tripId, value),
    analyticsConsumer(tripId, value),
    receiptConsumer(tripId, value),
  ]);

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`tripEvent consumer ${i} failed for ${tripId}/${value.type}:`, r.reason);
    }
  });
});

const NOTIFY_COPY: Partial<Record<TripEvent["type"], string>> = {
  offered: "A new job is waiting for you.",
  accepted: "A driver accepted your trip.",
  arrived: "Your driver has arrived at the pickup point.",
  started: "Your trip has started.",
  completed: "Trip complete. Thank you for riding with TikTak.",
  cancelled: "This trip was cancelled.",
  no_drivers: "No drivers are available right now. Please try again shortly.",
  payment_settled: "Payment confirmed.",
  payment_failed: "Payment failed. Please try again or pay in cash.",
};

/** Writes an in-app notification. Push delivery would hang off the same hook. */
async function notifyConsumer(tripId: string, event: TripEvent) {
  const message = NOTIFY_COPY[event.type];
  if (!message) return;

  const tripSnap = await db.ref(`trips/${tripId}`).get();
  const trip = tripSnap.val();
  const recipients = new Set<string>();

  if (event.type === "offered" && event.actorId) {
    recipients.add(event.actorId);
  } else if (trip) {
    if (trip.riderId) recipients.add(trip.riderId);
    if (trip.driverId) recipients.add(trip.driverId);
  }

  const updates: Record<string, unknown> = {};
  recipients.forEach((uid) => {
    const key = db.ref(`notifications/${uid}`).push().key as string;
    updates[`notifications/${uid}/${key}`] = {
      tripId,
      type: event.type,
      message,
      at: event.at,
      read: false,
    };
  });

  if (Object.keys(updates).length > 0) await db.ref().update(updates);
}

/** Rolling counters for the marketplace view. */
async function analyticsConsumer(tripId: string, event: TripEvent) {
  const day = new Date(event.at).toISOString().slice(0, 10);
  await db.ref(`analytics/${day}/${event.type}`).transaction((n) => (typeof n === "number" ? n + 1 : 1));

  if (event.type === "completed") {
    const onTime = (event.data as { onTime?: boolean } | undefined)?.onTime;
    if (onTime === true) {
      await db.ref(`analytics/${day}/completed_on_time`).transaction((n) => (typeof n === "number" ? n + 1 : 1));
    } else if (onTime === false) {
      await db.ref(`analytics/${day}/completed_late`).transaction((n) => (typeof n === "number" ? n + 1 : 1));
    }
  }
}

/** Turns a settled payment into a receipt both parties can read back. */
async function receiptConsumer(tripId: string, event: TripEvent) {
  if (event.type !== "payment_settled") return;

  const tripSnap = await db.ref(`trips/${tripId}`).get();
  const trip = tripSnap.val();
  if (!trip) return;

  const data = (event.data ?? {}) as { method?: string; amount?: number };
  const receipt = {
    tripId,
    amount: data.amount ?? trip.price,
    currency: "RWF",
    method: data.method ?? "unknown",
    at: event.at,
    fare: trip.fare ?? null,
  };

  const updates: Record<string, unknown> = {};
  if (trip.riderId) updates[`receipts/${trip.riderId}/${tripId}`] = receipt;
  if (trip.driverId) updates[`receipts/${trip.driverId}/${tripId}`] = receipt;
  if (Object.keys(updates).length > 0) await db.ref().update(updates);
}
