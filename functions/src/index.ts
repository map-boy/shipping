import { setGlobalOptions } from "firebase-functions/v2/options";

/**
 * Region and capacity.
 *
 * Defaults to us-central1 so existing deployments are untouched. Moving closer
 * to your users cuts a round trip off every call, but changing the region of an
 * already-deployed function means deleting the old one first - Firebase will not
 * migrate it in place. Set FUNCTIONS_REGION only when you are ready to do that,
 * and match it to the region your Realtime Database instance lives in, or you
 * will trade client latency for database latency.
 *
 * maxInstances is sized for peak (a Friday night), not for the average.
 */
setGlobalOptions({
  region: process.env.FUNCTIONS_REGION || "us-central1",
  maxInstances: Number(process.env.FUNCTIONS_MAX_INSTANCES || 40),
  concurrency: 40,
  memory: "256MiB",
  timeoutSeconds: 60,
});

// Trip lifecycle
export {
  createTrip,
  acceptTrip,
  declineOffer,
  dispatchTick,
  arriveAtPickup,
  startTrip,
  cancelTrip,
  completeTrip,
} from "./trip";

// Pricing and catalog
export { quoteFare, quoteTruckFare, getCatalog } from "./pricing";

// Marketplace
export { marketConditions } from "./marketplace";

// Payments
export { requestMomoPayment, checkMomoPaymentStatus, markCashPayment } from "./payment";

// Trust: ratings and proof of delivery
export { rateTrip, confirmDelivery } from "./trust";

// Scheduled dispatch upkeep
export { dispatchSweep, offerCleanup } from "./scheduled";

// Event fan-out
export { onTripEvent } from "./consumers";

// Admin
export {
  adminLogin,
  adminListTrips,
  adminListDrivers,
  adminListBans,
  adminMarketplace,
  adminDeleteTrip,
  adminSetUserBan,
  adminSetDriverStatus,
  adminDispatchSweep,
} from "./admin";
