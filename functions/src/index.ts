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

  /**
   * Kept deliberately small.
   *
   * Concurrency above 1 forces Cloud Run to allocate a full vCPU per instance,
   * so the CPU a deployment reserves is roughly (functions x maxInstances). At
   * 40 that was over a thousand vCPUs across this codebase and the deploy died
   * with "Quota exceeded for total allowable CPU per project per region",
   * taking acceptTrip, startTrip, cancelTrip and markCashPayment with it.
   *
   * 5 instances x 20 concurrent requests is 100 in-flight calls per function,
   * which is far beyond what this service needs today. Raise it once the
   * project's Cloud Run CPU quota has been raised to match.
   */
  maxInstances: Number(process.env.FUNCTIONS_MAX_INSTANCES || 5),
  concurrency: 20,
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
export { quoteFare, quoteTruckFare, quoteBusFare, getCatalog } from "./pricing";

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
