# TikTak

Rides, freight and temperature-controlled delivery in Rwanda. React + Vite +
TypeScript on the front, Firebase Realtime Database and Cloud Functions on the
back, MTN Mobile Money for payment.

## Setup

```bash
npm install
cp .env.example .env.local        # fill in Firebase + Google Maps values
npm run dev
```

Backend:

```bash
cd functions && npm install
cp .env.example .env              # local emulator only; use secrets in production
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint over the whole project |
| `npm run build` | Typecheck then production build into `dist/` |
| `npm run verify` | typecheck + lint + build — run before every deploy |

## Service catalogue

Three service classes, priced off the same distance calculation:

| Class | Window | Price effect |
| --- | --- | --- |
| Express | Same day | 1.6x, dispatched immediately, surge applies |
| First class | 1–3 days | 1.0x |
| Second class | 3–7 days | 0.75x |

Three temperature options for goods:

| Handling | Target | Price effect |
| --- | --- | --- |
| Room temperature (RT) | ambient | 1.0x |
| Chilled | 2 to 8 °C | 1.25x |
| Frozen | −25 to −15 °C | 1.45x |

Cold-chain work is only ever offered to drivers who have marked their vehicle as
cold-chain capable.

Five vehicle classes: standard car, small car hire, bus, truck, VIP car. Trucks
carry goods only; VIP cars carry passengers only; the rest carry both.

```
fare = (vehicleBase + km × vehiclePerKm)
       × serviceClassMultiplier
       × handlingMultiplier
       × surgeMultiplier        (express only)
```

Nothing about the fare is computed in the browser. `quoteFare` prices every
eligible vehicle and `createTrip` recomputes with the same function, so the
displayed price and the charged price cannot drift apart.

## Dispatch

Jobs are **not** broadcast. `createTrip` ranks nearby drivers and offers the job
to one driver at a time:

```
rank by:  ETA to pickup  +  (5 − rating) × 2  +  (1 − acceptRate) × 3
filter:   online, no active job, matching vehicle, cold-chain capable if needed,
          position fresher than 90s, within 15 km
```

The top-ranked driver gets an exclusive 20-second offer written to
`driverOffers/{driverId}/{tripId}`. No other driver can see it. On accept, an
atomic compare-and-set flips the trip to `accepted`; on pass or lapse, the job
moves down the ranked list, up to 8 drivers.

First and second class work is not dispatched at booking time. It waits until
`promisedFrom`, then `adminDispatchSweep` releases it.

## Data layout

Every trip state change goes through a Cloud Function; the client never writes
to `trips`, which is why the rules deny client writes outright.

| Path | Who can read | Who can write |
| --- | --- | --- |
| `users/{uid}` | that user | that user |
| `drivers/{driverId}` | any signed-in user | that driver, shape-validated |
| `driverOffers/{driverId}` | that driver only | server only |
| `openDemand/{tripId}` | nobody | server only |
| `marketplace/{areaKey}` | any signed-in user | server only |
| `trips/{tripId}` | rider, assigned driver, currently-offered driver | server only |
| `tripEvents/{tripId}` | the trip's participants | server only |
| `activeTrips/{uid}` | that user | server only |
| `tripHistory/{uid}` | that user | server only |
| `receipts/{uid}` | that user | server only |
| `notifications/{uid}` | that user | server writes; owner may flip `read` |
| `analytics`, `bannedUsers` | nobody | server only |

### Hot and cold

`drivers/{id}` is hot: each GPS ping overwrites the position in place and no
history is kept. `tripEvents/{tripId}` is cold: an append-only log of the handful
of milestones that matter (requested, offered, accepted, arrived, started,
completed, cancelled, payment). Writing every ping to durable storage would be
mostly-useless volume.

### Events

`completeTrip` does not send notifications, write receipts or update analytics.
It appends a milestone and returns. `onTripEvent` picks that up and fans out to
three independent consumers under `Promise.allSettled`, so a failing consumer
cannot block the trip or the others.

## Trip lifecycle

```
createTrip → requested ──offer──▶ (one driver, 20s)
                 │                      │
                 │                 accept │ pass/lapse → next ranked driver
                 │                      ▼
                 │                  accepted → arriveAtPickup → startTrip
                 │                      │                          │
             cancelTrip             cancelTrip                 in_progress
            (rider: ends)         (driver: requeues)                │
                                                              completeTrip
                                                                    ▼
                                                    tripHistory + receipts
```

`completeTrip` records the delivery even when payment has not settled — the
amount is carried as `paymentStatus: "outstanding"`. A Mobile Money outage
cannot trap a driver in a finished job.

## Deploying

```powershell
.\scripts\Sync-And-Verify.ps1     # pull, install, typecheck, lint, build
.\scripts\Deploy.ps1 -SetSecrets  # first deploy: prompts for each secret
.\scripts\Deploy.ps1              # after that
.\scripts\Repair-Encoding.ps1     # rewrites any BOM / UTF-16 file as clean UTF-8
```

Order matters — rules, then functions, then hosting. The client calls
`quoteFare`, `acceptTrip`, `declineOffer`, `dispatchTick` and `arriveAtPickup`,
so shipping hosting first breaks the live app.

## Required server configuration

```bash
firebase functions:secrets:set ADMIN_USERNAME
firebase functions:secrets:set ADMIN_PASSWORD
firebase functions:secrets:set MOMO_API_USER
firebase functions:secrets:set MOMO_API_KEY
firebase functions:secrets:set MOMO_SUBSCRIPTION_KEY
```

The admin callables refuse every request unless `ADMIN_USERNAME` and
`ADMIN_PASSWORD` are both set — an unconfigured deployment fails closed.

### Region

Functions default to `us-central1`. Set `FUNCTIONS_REGION` to move them closer to
your users, but note two things: Firebase will not migrate a deployed function's
region in place (delete the old one first), and the region should match your
Realtime Database instance or you trade client latency for database latency.

`FUNCTIONS_MAX_INSTANCES` (default 40) is sized for peak, not average load.

## Scheduling the sweep

`adminDispatchSweep` expires dead express requests, advances stalled offers, and
releases first/second class work once its window opens. Nothing calls it
automatically — point Cloud Scheduler at it, or run it from the admin tooling.
Without it, scheduled-class jobs are never dispatched.

## Known limits

- Ranking uses a straight-line ETA at an assumed 22 km/h, not live traffic.
  Road-network ETA is fetched in the client maps but does not yet feed ranking.
- Driver `rating` and `acceptRate` are read by the ranker but nothing writes
  them yet, so every driver currently scores on distance alone.
- A driver stays `online` until they tap "Go offline". Riders stop seeing them
  after 90 seconds without a position update.
- Cash payment is recorded on the driver's word. There is no reconciliation.
- The offer watchdog runs in the rider's browser. If the rider closes the app
  mid-search, offers only advance when the sweep next runs.
