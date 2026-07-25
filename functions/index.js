const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();

const MOMO_BASE_URL = process.env.MOMO_ENV === "production"
  ? "https://proxy.momoapi.mtn.com"
  : "https://sandbox.momodeveloper.mtn.com";

async function getMomoToken() {
  const auth = Buffer.from(`${process.env.MOMO_API_USER}:${process.env.MOMO_API_KEY}`).toString("base64");
  const res = await axios.post(
    `${MOMO_BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY,
      },
    }
  );
  return res.data.access_token;
}

exports.requestMomoPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { phoneNumber, amount, tripId } = data;
  if (!phoneNumber || !amount || !tripId) {
    throw new functions.https.HttpsError("invalid-argument", "phoneNumber, amount, and tripId are required.");
  }

  const referenceId = uuidv4();
  const token = await getMomoToken();

  await axios.post(
    `${MOMO_BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: String(amount),
      currency: process.env.MOMO_ENV === "production" ? "RWF" : "EUR",
      externalId: tripId,
      payer: { partyIdType: "MSISDN", partyId: phoneNumber },
      payerMessage: "TikTak trip payment",
      payeeNote: `Payment for trip ${tripId}`,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": process.env.MOMO_ENV || "sandbox",
        "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  await admin.database().ref(`trips/${tripId}/payment`).set({
    referenceId,
    status: "pending",
    amount,
    createdAt: Date.now(),
  });

  return { referenceId };
});

exports.checkMomoPaymentStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }
  const { referenceId, tripId } = data;
  const token = await getMomoToken();

  const res = await axios.get(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": process.env.MOMO_ENV || "sandbox",
      "Ocp-Apim-Subscription-Key": process.env.MOMO_SUBSCRIPTION_KEY,
    },
  });

  const status = res.data.status.toLowerCase();
  await admin.database().ref(`trips/${tripId}/payment/status`).set(status);

  return { status };
});
