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

Bus and truck are priced by their own tariffs and ignore the table below.

### Truck freight

| Billing | Formula |
| --- | --- |
| By tonnes | `250,000 + (250 x km x tonnes)` |
| By tours | `7,500 x km x tours` |

Both are the same underlying rate of **250 RWF per tonne-km** - the tariff writes
it as `0.25 x 1000` - and a tour is one full 30 t truckload, so
`0.25 x 30,000 = 7,500` per tour-km. Only tonnage carries the 250,000 floor.

| Case | Price |
| --- | --- |
| 101 km, 1 tonne | 275,250 |
| 101 km, 5 tonnes | 376,250 |
| 101 km, 1 tour | 757,500 |
| 101 km, 5 tours | 3,787,500 |

### Bus charter

A bus is hired as a whole vehicle for a **round trip**, so the billed distance is
always each-way x 2.

| Round trip | Price |
| --- | --- |
| up to 100 km (50 km each way) | flat 200,000 RWF minimum |
| beyond that | 90 RWF x 29 seats x round-trip km |

Kigali - Kayonza, 85 km each way: `90 x 29 x 170 = 443,700 RWF`.

Service class, temperature and surge do not apply - it is a quoted charter, not
metered work. Crossing the 50 km each-way threshold steps the price from 200,000
to about 261,500, because the rate applies to the whole distance rather than only
the excess.

```
fare = (vehicleBase + km × vehiclePerKm)
       × serviceClassMultiplier
       × handlingMultiplier
       × surgeMultiplier        (express only)
```

Nothing about the fare is computed in the browser. `quoteFare` prices every
eligible vehicle and `createTrip` recomputes with the same function, so the
displayed price and the charged price cannot drift apart.

## Accounts

Booking needs no login. `ensureUser` signs a customer in **anonymously** on
their first order, so there is no screen and no password but there is still a
uid - which trip ownership, the database rules, `activeTrips/{uid}` and live
tracking all depend on. **Enable the Anonymous provider** in Firebase
Authentication or booking fails.

Driving is different: `/driver` requires a real account. A guest session has no
recoverable identity, and a driver carries other people's goods and cash.

## Book or order

`/book` is the three-step ordering flow:

1. **Your details** - full name and phone, plus the vehicle from a dropdown
   (truck, VIP car, standard car, small car hire, bus).
2. **Where from, where to** - both points set on the map with the drag-to-pin
   picker.
3. **Price** - calculated from those two locations the moment the step opens.

Step 3 carries a notice that the quote covers the drop-off exactly as declared,
and that going past it is charged separately. The customer has to tick it before
the order can be placed, and `createTrip` stores `quotedDistanceKm` alongside
`extraDistanceChargeable` so the agreed distance is on the record.

Contact name and phone are stored on the trip so the driver knows who to call.
Phone numbers are normalised to Rwandan MSISDN (2507XXXXXXXX) by the server;
`0781234567`, `781234567` and `+250 781 234 567` are all accepted.

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
| `driverStats/{driverId}` | that driver | server only |
| `driverOffers/{driverId}` | that driver only | server only |
| `openDemand/{tripId}` | nobody | server only |
| `marketplace/{areaKey}` | any signed-in user | server only |
| `trips/{tripId}` | rider, assigned driver, currently-offered driver | server only |
| `tripEvents/{tripId}` | the trip's participants | server only |
| `activeTrips/{uid}` | that user | server only |
| `tripHistory/{uid}` | that user | server only |
| `receipts/{uid}` | that user | server only |
| `ratings/{tripId}` | any signed-in user | server only |
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

## CI

`.github/workflows/verify.yml` runs typecheck, lint and build for the web app,
typecheck and build for the functions, and validates `database.rules.json` plus
a BOM/UTF-16 check on every pull request.

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

### Cloud Run CPU quota

Concurrency above 1 makes Cloud Run allocate a full vCPU per instance, so a
deployment reserves roughly `functions x maxInstances` vCPUs. With ~30 functions
that number gets large quickly, and the deploy fails with **"Quota exceeded for
total allowable CPU per project per region"** - which aborts unrelated functions
mid-deploy.

The trap is `concurrency`: **any value above 1 forces a full vCPU per
instance**. Lowering `maxInstances` alone does not help much - 31 functions at 5
instances is still 155 vCPU.

So the deployment runs `concurrency: 1` with `cpu: "gcf_gen1"`, giving each
256MiB instance about 0.167 vCPU - exactly how 1st-generation functions ran.
With `maxInstances: 3` that is roughly 16 vCPU in total, which fits a default
quota with no quota increase and no billing change.

The cost is one request per instance, so heavy traffic means more cold starts.
Raise `FUNCTIONS_MAX_INSTANCES` first when real load justifies it; only raise
`concurrency` after the Cloud Run CPU quota has been raised, since that
re-triggers the full-vCPU rule.

### Database trigger region

`onTripEvent` is a Realtime Database trigger, and the database has its own
region independent of where the functions run. A wrong region fails the deploy
with "pattern cannot match any databases in region ..." and takes unrelated
functions down with it, so **the trigger is off by default**.

To enable it, put both of these in `functions/.env`:

```
RTDB_REGION=<your database region>
ENABLE_TRIP_EVENT_TRIGGER=true
```

The region is in your `databaseURL` (`https://<name>.<region>.firebasedatabase.app`);
a legacy `firebaseio.com` URL means `us-central1`. Only notifications, receipts
and analytics depend on this trigger - booking, dispatch, payment and tracking
do not.

### Region

Functions default to `us-central1`. Set `FUNCTIONS_REGION` to move them closer to
your users, but note two things: Firebase will not migrate a deployed function's
region in place (delete the old one first), and the region should match your
Realtime Database instance or you trade client latency for database latency.

`FUNCTIONS_MAX_INSTANCES` (default 40) is sized for peak, not average load.

## Scheduled upkeep

`dispatchSweep` runs every two minutes and `offerCleanup` every ten. Between
them they expire dead express requests, advance offers whose holder went quiet,
release first/second class work once its promised window opens, and clear lapsed
offer records. `adminDispatchSweep` runs the same sweep on demand.

These are `onSchedule` functions, so `firebase deploy --only functions`
provisions the Cloud Scheduler jobs for you. They need the Blaze plan, as do all
v2 functions.

## Trust

Both parties can rate a completed trip with `rateTrip`. Rider-on-driver scores
feed `driverStats/{driverId}.rating`, which the dispatcher ranks on, and only
count once a driver has at least three ratings. `driverStats` is a separate node
from `drivers` precisely because the driver's own client writes `drivers` on
every GPS ping — a driver can never write their own rating, and a position
update can never overwrite one.

Goods trips carry a four-digit delivery code. The sender sees it in their app;
the driver must enter it via `confirmDelivery` before `completeTrip` will close
the job. Passenger trips have no code — the rider is present.

## Known limits

- Ranking uses a straight-line ETA at an assumed 22 km/h, not live traffic.
  Road-network ETA is fetched in the client maps but does not yet feed ranking.
- A new driver ranks on distance alone until they have three ratings and five
  offers behind them; before that the defaults apply.
- A driver stays `online` until they tap "Go offline". Riders stop seeing them
  after 90 seconds without a position update.
- Cash payment is recorded on the driver's word. There is no reconciliation.
- The offer watchdog runs in the rider's browser for fast hand-off; if the rider
  closes the app mid-search, the two-minute sweep picks it up instead.
- Ratings are per trip and unweighted — no recency decay, no fraud checks.
