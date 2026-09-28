import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import axios from "axios";
import { randomUUID } from "crypto";
import { db } from "./lib/db";
import { requireAuth, requireString, normalizeRwandaMsisdn } from "./lib/validate";
import { tripEventUpdate } from "./lib/events";

const MOMO_ENV = process.env.MOMO_ENV || "sandbox";
const MOMO_BASE_URL = MOMO_ENV === "production"
  ? "https://proxy.momoapi.mtn.com"
  : "https://sandbox.momodeveloper.mtn.com";

async function getTrip(tripId: string) {
  const snap = await db.ref(`trips/${tripId}`).get();
  if (!snap.exists()) {
    throw new HttpsError("not-found", "Trip not found.");
  }
  return snap.val();
}

async function getMomoToken(): Promise<string> {
  const apiUser = process.env.MOMO_API_USER;
  const apiKey = process.env.MOMO_API_KEY;
  const subscriptionKey = process.env.MOMO_SUBSCRIPTION_KEY;
  if (!apiUser || !apiKey || !subscriptionKey) {
    throw new HttpsError("failed-precondition", "Mobile Money is not configured on the server.");
  }

  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");
  try {
    const res = await axios.post(
      `${MOMO_BASE_URL}/collection/token/`,
      {},
      { headers: { Authorization: `Basic ${auth}`, "Ocp-Apim-Subscription-Key": subscriptionKey } }
    );
    return res.data.access_token;
  } catch (err) {
    console.error("MoMo token error:", axios.isAxiosError(err) ? err.response?.data : err);
    throw new HttpsError("unavailable", "Mobile Money is unreachable. You can still pay the driver in cash.");
  }
}

/** MTN returns free-form casing; only these three values ever reach the database. */
function normalizeMomoStatus(raw: unknown): "pending" | "successful" | "failed" {
  const value = String(raw ?? "").toLowerCase();
  if (value === "successful") return "successful";
  if (value === "pending") return "pending";
  return "failed";
}

export const requestMomoPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const phoneNumber = normalizeRwandaMsisdn(request.data?.phoneNumber);

  const trip = await getTrip(tripId);

  if (trip.riderId !== uid) {
    throw new HttpsError("permission-denied", "You do not own this trip.");
  }
  if (trip.status !== "accepted" && trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Wait for a driver to accept before paying.");
  }
  if (trip.paymentStatus === "pending" || trip.paymentStatus === "successful" || trip.paymentStatus === "cash") {
    throw new HttpsError("failed-precondition", "Payment already requested or completed for this trip.");
  }

  const amount = trip.price;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("failed-precondition", "Trip has no valid price set.");
  }

  const referenceId = randomUUID();
  const token = await getMomoToken();

  try {
    await axios.post(
      `${MOMO_BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount: String(amount),
        currency: MOMO_ENV === "production" ? "RWF" : "EUR",
        externalId: tripId,
        payer: { partyIdType: "MSISDN", partyId: phoneNumber },
        payerMessage: "TikTak trip payment",
        payeeNote: `Payment for trip ${tripId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": MOMO_ENV,
          "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("MoMo requesttopay error:", axios.isAxiosError(err) ? err.response?.data : err);
    throw new HttpsError("unavailable", "Mobile Money rejected the request. You can pay the driver in cash instead.");
  }

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/paymentStatus`]: "pending",
    [`trips/${tripId}/paymentReferenceId`]: referenceId,
    [`trips/${tripId}/paymentAmount`]: amount,
    [`trips/${tripId}/paymentCreatedAt`]: now,
    ...tripEventUpdate(tripId, { type: "payment_requested", at: now, actorId: uid, data: { amount } }),
  });

  return { referenceId };
});

export const checkMomoPaymentStatus = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");

  const trip = await getTrip(tripId);

  // Without these checks any signed-in user could stamp "successful" onto
  // somebody else's trip using a reference from a payment they made themselves.
  if (trip.riderId !== uid && trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "You are not part of this trip.");
  }
  if (!trip.paymentReferenceId) {
    throw new HttpsError("failed-precondition", "No payment has been requested for this trip.");
  }

  const referenceId: string = trip.paymentReferenceId;
  const token = await getMomoToken();

  let status: "pending" | "successful" | "failed";
  try {
    const res = await axios.get(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": MOMO_ENV,
        "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
      },
    });
    if (res.data?.externalId && res.data.externalId !== tripId) {
      throw new HttpsError("failed-precondition", "That payment belongs to a different trip.");
    }
    status = normalizeMomoStatus(res.data?.status);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("MoMo status check error:", axios.isAxiosError(err) ? err.response?.data : err);
    throw new HttpsError("unavailable", "Could not check payment status.");
  }

  const updates: Record<string, unknown> = { [`trips/${tripId}/paymentStatus`]: status };
  if (status !== "pending") {
    Object.assign(
      updates,
      tripEventUpdate(tripId, {
        type: status === "successful" ? "payment_settled" : "payment_failed",
        at: Date.now(),
        data: { method: "momo", amount: trip.paymentAmount ?? trip.price },
      })
    );
  }
  await db.ref().update(updates);

  return { status };
});

export const markCashPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);

  if (trip.driverId !== uid) {
    throw new HttpsError("permission-denied", "Only the assigned driver can do this.");
  }
  if (trip.status !== "accepted" && trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Trip must be under way to take cash.");
  }
  if (trip.paymentStatus === "successful") {
    throw new HttpsError("failed-precondition", "This trip was already paid via Mobile Money.");
  }

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/paymentStatus`]: "cash",
    [`trips/${tripId}/paymentAmount`]: trip.price,
    ...tripEventUpdate(tripId, {
      type: "payment_settled",
      at: now,
      actorId: uid,
      data: { method: "cash", amount: trip.price },
    }),
  });
  return { ok: true };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const IntouchApi = require("intouch-payments");

function getIntouchClient() {
  const username = process.env.INTOUCH_USERNAME;
  const accountNo = process.env.INTOUCH_ACCOUNT_NO;
  const partnerPassword = process.env.INTOUCH_PARTNER_PASSWORD;
  const callbackUrl = process.env.INTOUCH_CALLBACK_URL;
  if (!username || !accountNo || !partnerPassword) {
    throw new HttpsError("failed-precondition", "IntouchPay is not configured on the server.");
  }
  return new IntouchApi(username, accountNo, partnerPassword, callbackUrl);
}

/** IntouchPay's status vocabulary is not publicly documented, so this matches
 *  loosely on substrings rather than an exact expected value. */
function normalizeIntouchStatus(raw: unknown): "pending" | "successful" | "failed" {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("success")) return "successful";
  if (value.includes("fail") || value.includes("error") || value.includes("reject")) return "failed";
  return "pending";
}

/** MTN or Airtel via IntouchPay - one call covers both; IntouchPay auto-detects
 *  the network from the phone number's prefix. */
export const requestIntouchPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const phoneNumber = normalizeRwandaMsisdn(request.data?.phoneNumber);

  const trip = await getTrip(tripId);
  if (trip.riderId !== uid) {
    throw new HttpsError("permission-denied", "You do not own this trip.");
  }
  if (trip.status !== "accepted" && trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Wait for a driver to accept before paying.");
  }
  if (trip.paymentStatus === "pending" || trip.paymentStatus === "successful" || trip.paymentStatus === "cash") {
    throw new HttpsError("failed-precondition", "Payment already requested or completed for this trip.");
  }

  const amount = trip.price;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("failed-precondition", "Trip has no valid price set.");
  }

  const intouch = getIntouchClient();
  try {
    await intouch.requestPayment(amount, phoneNumber, tripId);
  } catch (err) {
    console.error("IntouchPay requestPayment error:", err);
    throw new HttpsError("unavailable", "Payment request failed. You can pay the driver in cash instead.");
  }

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/paymentStatus`]: "pending",
    [`trips/${tripId}/paymentProvider`]: "intouch",
    [`trips/${tripId}/paymentAmount`]: amount,
    [`trips/${tripId}/paymentCreatedAt`]: now,
    ...tripEventUpdate(tripId, { type: "payment_requested", at: now, actorId: uid, data: { amount, provider: "intouch" } }),
  });

  // requestPayment's own response is not the final word - IntouchPay confirms
  // completion asynchronously by posting to the callback URL below.
  return { ok: true };
});

/**
 * IntouchPay posts here when a payment settles. Field names are not publicly
 * documented, so every plausible key is checked, and the raw body is logged
 * so a mismatch is easy to spot and fix from the function logs.
 */
export const intouchPaymentCallback = onRequest(async (req, res) => {
  const body = req.body ?? {};
  const expectedToken = process.env.INTOUCH_CALLBACK_TOKEN;
  if (!expectedToken || req.query.token !== expectedToken) {
    console.error("IntouchPay callback rejected: missing or wrong token");
    res.status(403).send("forbidden");
    return;
  }
  const tripId =
    body.transactionid || body.requesttransactionid || body.reference || body.referenceid || body.tripId;
  const statusRaw = body.status || body.responsemessage || body.message;

  if (!tripId || typeof tripId !== "string") {
    console.error("IntouchPay callback missing a recognisable transaction id:", body);
    res.status(400).send("missing transaction id");
    return;
  }

  const snap = await db.ref(`trips/${tripId}`).get();
  if (!snap.exists()) {
    console.error("IntouchPay callback for unknown trip:", tripId, body);
    res.status(404).send("unknown trip");
    return;
  }
  const trip = snap.val();
  const status = normalizeIntouchStatus(statusRaw);
  if (trip.paymentProvider !== "intouch" || trip.paymentStatus !== "pending") {
    res.status(200).send("ignored");
    return;
  }

  const updates: Record<string, unknown> = { [`trips/${tripId}/paymentStatus`]: status };
  if (status !== "pending") {
    Object.assign(
      updates,
      tripEventUpdate(tripId, {
        type: status === "successful" ? "payment_settled" : "payment_failed",
        at: Date.now(),
        data: { method: "intouch", amount: trip.paymentAmount ?? trip.price },
      })
    );
  }
  await db.ref().update(updates);
  res.status(200).send("ok");
});
