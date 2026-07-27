import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

initializeApp();
const db = getDatabase();

const MOMO_ENV = process.env.MOMO_ENV || "sandbox";
const MOMO_BASE_URL = MOMO_ENV === "production"
  ? "https://proxy.momoapi.mtn.com"
  : "https://sandbox.momodeveloper.mtn.com";

async function getMomoToken(): Promise<string> {
  const auth = Buffer.from(`${process.env.MOMO_API_USER}:${process.env.MOMO_API_KEY}`).toString("base64");
  try {
    const res = await axios.post(
      `${MOMO_BASE_URL}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
        },
      }
    );
    return res.data.access_token;
  } catch (err: any) {
    console.error("MoMo token error:", err.response?.data || err.message);
    throw new HttpsError("internal", "Could not authenticate with Mobile Money.");
  }
}

export const requestMomoPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { phoneNumber, amount, tripId } = request.data;
  if (!phoneNumber || !amount || !tripId) {
    throw new HttpsError("invalid-argument", "phoneNumber, amount, and tripId are required.");
  }

  const referenceId = uuidv4();
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
  } catch (err: any) {
    console.error("MoMo requesttopay error:", err.response?.data || err.message);
    const reason = err.response?.data?.message || "Mobile Money rejected the payment request.";
    throw new HttpsError("internal", reason);
  }

  await db.ref(`trips/${tripId}/paymentStatus`).set("pending");
  await db.ref(`trips/${tripId}/paymentReferenceId`).set(referenceId);
  await db.ref(`trips/${tripId}/paymentAmount`).set(amount);
  await db.ref(`trips/${tripId}/paymentCreatedAt`).set(Date.now());

  return { referenceId };
});

export const checkMomoPaymentStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const { referenceId, tripId } = request.data;
  if (!referenceId || !tripId) {
    throw new HttpsError("invalid-argument", "referenceId and tripId are required.");
  }

  const token = await getMomoToken();

  let status: string;
  try {
    const res = await axios.get(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": MOMO_ENV,
        "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY as string,
      },
    });
    status = res.data.status.toLowerCase();
  } catch (err: any) {
    console.error("MoMo status check error:", err.response?.data || err.message);
    throw new HttpsError("internal", "Could not check payment status.");
  }

  await db.ref(`trips/${tripId}/paymentStatus`).set(status);

  return { status };
});