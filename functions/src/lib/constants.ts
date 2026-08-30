/** A driver silent for this long is treated as unavailable for matching. */
export const DRIVER_STALE_AFTER_MS = 90_000;

/** How long one driver holds an exclusive offer before it passes to the next. */
export const OFFER_TTL_MS = 20_000;

/** How many ranked drivers a single trip will be offered to before giving up. */
export const MAX_OFFER_ROUNDS = 8;

/** How far out to look for candidate drivers. */
export const DISPATCH_RADIUS_KM = 15;

/** How long an express request stays live with nobody accepting. */
export const REQUEST_TTL_MS = 15 * 60 * 1000;

/** Assumed city driving speed when no routing data is available. */
export const FALLBACK_SPEED_KMH = 22;
