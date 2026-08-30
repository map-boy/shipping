import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./lib/db";
import { buildOfferUpdates, clearDispatchUpdates } from "./dispatch";
import { tripEventUpdate } from "./lib/events";

interface SweepResult {
  scanned: number;
  expired: number;
  advanced: number;
  released: number;
}

/**
 * Keeps dispatch moving without anyone touching it:
 *  - expires express requests nobody took,
 *  - advances offers whose holder went quiet,
 *  - releases first/second class work once its promised window opens.
 *
 * Without this, scheduled-class freight would sit in `requested` forever, because
 * nothing else ever offers it out.
 */
export async function sweepDispatch(now = Date.now()): Promise<SweepResult> {
  const snap = await db.ref("trips").get();
  const trips = (snap.val() || {}) as Record<string, Record<string, unknown>>;

  const result: SweepResult = { scanned: Object.keys(trips).length, expired: 0, advanced: 0, released: 0 };

  for (const [tripId, trip] of Object.entries(trips)) {
    if (trip.status !== "requested") continue;

    const serviceClass = trip.serviceClass as string | undefined;
    const expiresAt = trip.expiresAt as number | undefined;
    const promisedFrom = trip.promisedFrom as number | undefined;
    const offerExpiresAt = trip.offerExpiresAt as number | undefined;
    const riderId = trip.riderId as string | undefined;

    if (serviceClass === "express" && typeof expiresAt === "number" && expiresAt < now) {
      const record = { ...trip, status: "expired", completedAt: now };
      await db.ref().update({
        [`trips/${tripId}`]: null,
        [`openDemand/${tripId}`]: null,
        ...(riderId
          ? { [`tripHistory/${riderId}/${tripId}`]: record, [`activeTrips/${riderId}`]: null }
          : {}),
        ...clearDispatchUpdates(tripId, trip),
        ...tripEventUpdate(tripId, { type: "offer_expired", at: now, data: { reason: "request-ttl" } }),
      });
      result.expired += 1;
      continue;
    }

    const dueNow = serviceClass === "express" || (typeof promisedFrom === "number" && promisedFrom <= now);
    if (!dueNow) continue;

    if (typeof offerExpiresAt === "number" && offerExpiresAt > now) continue;

    const wasWaiting = !trip.offeredTo;
    const next = await buildOfferUpdates(tripId, trip as never);
    if (next) {
      await db.ref().update(next);
      if (wasWaiting) result.released += 1;
      else result.advanced += 1;
    }
  }

  return result;
}

export const dispatchSweep = onSchedule(
  { schedule: "every 2 minutes", timeoutSeconds: 120, retryCount: 1 },
  async () => {
    const result = await sweepDispatch();
    if (result.expired || result.advanced || result.released) {
      console.log("dispatch sweep:", result);
    }
  }
);

/** Retires driver offers that lapsed without the trip itself moving on. */
export const offerCleanup = onSchedule({ schedule: "every 10 minutes" }, async () => {
  const now = Date.now();
  const snap = await db.ref("driverOffers").get();
  const byDriver = (snap.val() || {}) as Record<string, Record<string, { expiresAt?: number }>>;

  const updates: Record<string, unknown> = {};
  let removed = 0;
  for (const [driverId, offers] of Object.entries(byDriver)) {
    for (const [tripId, offer] of Object.entries(offers)) {
      if (typeof offer.expiresAt === "number" && offer.expiresAt < now - 60_000) {
        updates[`driverOffers/${driverId}/${tripId}`] = null;
        removed += 1;
      }
    }
  }

  if (removed > 0) {
    await db.ref().update(updates);
    console.log(`offer cleanup removed ${removed} stale offers`);
  }
});
