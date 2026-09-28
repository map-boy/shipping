import axios from "axios";

const AT_ENV = process.env.AT_ENV === "production" ? "production" : "sandbox";
const AT_BASE_URL = AT_ENV === "production"
  ? "https://api.africastalking.com/version1/messaging"
  : "https://api.sandbox.africastalking.com/version1/messaging";

/**
 * Sends an SMS via Africa's Talking. Failures are logged, never thrown - a
 * missing text message must never be the reason a booking fails.
 */
export async function sendSms(to: string | string[], message: string): Promise<void> {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || "sandbox";
  if (!apiKey) {
    console.error("AT_API_KEY is not configured; skipping SMS.");
    return;
  }
  const recipients = (Array.isArray(to) ? to : [to]).map((n) => n.trim()).filter(Boolean).map((n) => (n.startsWith("+") ? n : `+${n}`)).join(",");
  try {
    await axios.post(
      AT_BASE_URL,
      new URLSearchParams({
        username,
        to: recipients,
        message,
        ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}),
      }),
      {
        headers: {
          apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      }
    );
  } catch (err) {
    console.error("SMS send failed:", axios.isAxiosError(err) ? err.response?.data : err);
  }
}
