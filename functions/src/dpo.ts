import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import axios from "axios";
import { db } from "./lib/db";
import { requireAuth, requireString } from "./lib/validate";
import { tripEventUpdate } from "./lib/events";

const DPO_API_URL = "https://secure.3gdirectpay.com/API/v6/";
const DPO_PAY_URL = "https://secure.3gdirectpay.com/payv2.php";

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : "";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function config() {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const serviceType = process.env.DPO_SERVICE_TYPE;
  const returnUrl = process.env.DPO_RETURN_URL;
  if (!companyToken || !serviceType || !returnUrl) {
    throw new HttpsError("failed-precondition", "Card payments are not configured yet.");
  }
  return { companyToken, serviceType, returnUrl };
}

async function dpoCall(xml: string): Promise<string> {
  const res = await axios.post(DPO_API_URL, xml, {
    headers: { "Content-Type": "application/xml" },
    timeout: 20000,
  });
  return String(res.data);
}

async function getTrip(tripId: string) {
  const snap = await db.ref(`trips/${tripId}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Trip not found.");
  return snap.val();
}

/** Starts a card payment. The amount always comes from the trip, never the browser. */
export const createDpoPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const { companyToken, serviceType, returnUrl } = config();

  const trip = await getTrip(tripId);
  if (trip.riderId !== uid) throw new HttpsError("permission-denied", "You do not own this trip.");
  if (trip.status !== "accepted" && trip.status !== "in_progress") {
    throw new HttpsError("failed-precondition", "Wait for a driver to accept before paying.");
  }
  if (trip.paymentStatus === "pending" || trip.paymentStatus === "successful" || trip.paymentStatus === "cash") {
    throw new HttpsError("failed-precondition", "Payment already requested or completed for this trip.");
  }
  if (typeof trip.price !== "number" || !Number.isFinite(trip.price) || trip.price <= 0) {
    throw new HttpsError("failed-precondition", "Trip has no valid price set.");
  }
  const amount = Math.round(trip.price);

  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const serviceDate = `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

  const xml =
    `<?xml version="1.0" encoding="utf-8"?><API3G>` +
    `<CompanyToken>${esc(companyToken)}</CompanyToken><Request>createToken</Request>` +
    `<Transaction><PaymentAmount>${amount.toFixed(2)}</PaymentAmount><PaymentCurrency>RWF</PaymentCurrency>` +
    `<CompanyRef>${esc(tripId)}</CompanyRef><RedirectURL>${esc(returnUrl)}</RedirectURL>` +
    `<BackURL>${esc(returnUrl)}</BackURL><CompanyRefUnique>0</CompanyRefUnique><PTL>30</PTL></Transaction>` +
    `<Services><Service><ServiceType>${esc(serviceType)}</ServiceType>` +
    `<ServiceDescription>TikTak trip ${esc(tripId.slice(-6).toUpperCase())}</ServiceDescription>` +
    `<ServiceDate>${serviceDate}</ServiceDate></Service></Services></API3G>`;

  let res: string;
  try {
    res = await dpoCall(xml);
  } catch (err) {
    console.error("DPO createToken request failed:", err);
    throw new HttpsError("unavailable", "Card payment is unavailable. You can pay in cash instead.");
  }
  const token = tag(res, "TransToken");
  if (tag(res, "Result") !== "000" || !token) {
    console.error("DPO createToken rejected:", res);
    throw new HttpsError("unavailable", "Card payment could not be started. You can pay in cash instead.");
  }

  const now = Date.now();
  await db.ref().update({
    [`trips/${tripId}/paymentStatus`]: "pending",
    [`trips/${tripId}/paymentProvider`]: "dpo",
    [`trips/${tripId}/dpoToken`]: token,
    [`trips/${tripId}/paymentAmount`]: amount,
    [`trips/${tripId}/paymentCreatedAt`]: now,
    ...tripEventUpdate(tripId, { type: "payment_requested", at: now, actorId: uid, data: { amount, provider: "dpo" } }),
  });

  return { payUrl: `${DPO_PAY_URL}?ID=${token}` };
});

/** Asks DPO directly whether the token was paid. Nothing else can mark a card trip paid. */
async function verifyAndSettle(tripId: string): Promise<string> {
  const trip = await getTrip(tripId);
  if (trip.paymentProvider !== "dpo" || !trip.dpoToken) return String(trip.paymentStatus ?? "none");
  if (trip.paymentStatus !== "pending") return String(trip.paymentStatus);

  const { companyToken } = config();
  const xml =
    `<?xml version="1.0" encoding="utf-8"?><API3G><CompanyToken>${esc(companyToken)}</CompanyToken>` +
    `<Request>verifyToken</Request><TransactionToken>${esc(String(trip.dpoToken))}</TransactionToken></API3G>`;
  const res = await dpoCall(xml);
  const result = tag(res, "Result");

  let status: "pending" | "successful" | "failed" = "pending";
  if (result === "000") {
    const paidRaw = tag(res, "TransactionAmount").replace(/,/g, "");
    const currency = tag(res, "TransactionCurrency").toUpperCase();
    const ref = tag(res, "CompanyRef");
    const amountOk = !paidRaw || Number(paidRaw) === Number(trip.paymentAmount);
    const currencyOk = !currency || currency === "RWF";
    const refOk = !ref || ref === tripId;
    if (amountOk && currencyOk && refOk) {
      status = "successful";
    } else {
      console.error("DPO paid but does not match the trip - needs manual review:", tripId, res);
    }
  } else if (["901", "902", "903", "904"].includes(result)) {
    status = "failed";
  } else if (result !== "900") {
    console.error("DPO verifyToken unexpected result:", result, res);
  }

  if (status !== "pending") {
    await db.ref().update({
      [`trips/${tripId}/paymentStatus`]: status,
      ...tripEventUpdate(tripId, {
        type: status === "successful" ? "payment_settled" : "payment_failed",
        at: Date.now(),
        data: { method: "dpo", amount: trip.paymentAmount ?? trip.price },
      }),
    });
  }
  return status;
}

export const verifyDpoPayment = onCall(async (request) => {
  const uid = requireAuth(request);
  const tripId = requireString(request.data?.tripId, "tripId");
  const trip = await getTrip(tripId);
  if (trip.riderId !== uid) throw new HttpsError("permission-denied", "You do not own this trip.");
  try {
    return { status: await verifyAndSettle(tripId) };
  } catch (err) {
    console.error("DPO verifyToken failed:", err);
    throw new HttpsError("unavailable", "Could not check the payment yet.");
  }
});

/**
 * Optional background ping from DPO. It trusts nothing in the body: it only uses it
 * to find the trip, then asks DPO itself whether the payment happened.
 */
export const dpoNotification = onRequest(async (req, res) => {
  const raw = req.rawBody ? req.rawBody.toString() : "";
  const tripId = tag(raw, "CompanyRef");
  const token = tag(raw, "TransactionToken");
  if (!/^[A-Za-z0-9_-]{5,60}$/.test(tripId)) {
    res.status(400).send("bad reference");
    return;
  }
  try {
    const snap = await db.ref(`trips/${tripId}`).get();
    if (snap.exists() && snap.val().dpoToken === token) await verifyAndSettle(tripId);
  } catch (err) {
    console.error("DPO notification handling failed:", err);
  }
  res.status(200).send("OK");
});