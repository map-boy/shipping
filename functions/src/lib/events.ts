import { db } from "./db";

export type TripEventType =
  | "requested"
  | "offered"
  | "offer_declined"
  | "offer_expired"
  | "accepted"
  | "arrived"
  | "started"
  | "completed"
  | "cancelled"
  | "payment_requested"
  | "payment_settled"
  | "payment_failed"
  | "no_drivers";

export interface TripEvent {
  type: TripEventType;
  at: number;
  actorId?: string;
  data?: Record<string, unknown>;
}

/**
 * Appends a milestone to the durable event log. This is the cold half of the
 * hot/cold split: GPS pings stay in `drivers/{id}` and are overwritten in place,
 * while these few per-trip milestones are kept forever.
 *
 * Writing an event is also what fans work out to downstream consumers - the
 * onTripEvent trigger reacts to it rather than the caller invoking notifications,
 * receipts and analytics inline.
 */
export function tripEventUpdate(
  tripId: string,
  event: TripEvent
): Record<string, unknown> {
  const key = db.ref(`tripEvents/${tripId}`).push().key as string;
  return { [`tripEvents/${tripId}/${key}`]: event };
}

export async function recordTripEvent(tripId: string, event: TripEvent): Promise<void> {
  await db.ref(`tripEvents/${tripId}`).push(event);
}
