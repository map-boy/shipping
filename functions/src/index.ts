import { setGlobalOptions } from "firebase-functions/v2/options";
import { onTripEvent as onTripEventImpl } from "./consumers";

/**
 * Region and capacity, sized to fit a default Cloud Run quota without asking
 * anyone to raise limits or change billing.
 *
 * The trap is `concurrency`. Any value above 1 forces Cloud Run to allocate a
 * full vCPU per instance, so reserved CPU is (functions x maxInstances x 1).
 * With 31 functions that was 155 vCPU at maxInstances 5 - still far over the
 * quota, which is why lowering maxInstances alone did not fix the deploy.
 *
 * concurrency 1 with cpu "gcf_gen1" gives each 256MiB instance ~0.167 vCPU,
 * exactly how 1st-generation functions ran. Reserved CPU becomes about
 * 31 x 3 x 0.167 = 16 vCPU, roughly a tenth of the previous demand.
 *
 * The cost is one request per instance, so heavy traffic means more cold
 * starts. That is the right trade for this stage; raise maxInstances (and only
 * then concurrency, which re-triggers the full-vCPU rule) when real load
 * justifies it.
 */
setGlobalOptions({
  region: process.env.FUNCTIONS_REGION || "us-central1",
  maxInstances: Number(process.env.FUNCTIONS_MAX_INSTANCES || 3),
  concurrency: 1,
  cpu: "gcf_gen1",
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

/**
 * Event fan-out.
 *
 * Off by default. It is a Realtime Database trigger, and the database has its
 * own region; a wrong one makes the whole deploy fail with "pattern cannot
 * match any databases in region ...", taking unrelated functions down with it.
 * Set RTDB_REGION in functions/.env to your database's region and set
 * ENABLE_TRIP_EVENT_TRIGGER=true to turn it on.
 *
 * Notifications, receipts and analytics are the only things that wait on it.
 * Booking, dispatch, payment and tracking do not.
 */
// The CLI deploys what is exported, so exporting undefined leaves it out.
export const onTripEvent =
  process.env.ENABLE_TRIP_EVENT_TRIGGER === "true" ? onTripEventImpl : undefined;

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
