# TikTak

Rides and goods delivery in Rwanda. React + Vite + TypeScript on the front, Firebase
Realtime Database and Cloud Functions on the back, MTN Mobile Money for payment.

## Setup

```bash
npm install
cp .env.example .env.local        # fill in Firebase + Google Maps values
npm run dev
```

For the backend:

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
| `npm run verify` | typecheck + lint + build — run this before every deploy |

## How the data is laid out

Every state change to a trip goes through a Cloud Function. The client never writes
to `trips` directly, which is why the database rules can deny client writes outright.

| Path | Who can read | Who can write |
| --- | --- | --- |
| `users/{uid}` | that user | that user |
| `drivers/{driverId}` | any signed-in user | that driver only, shape-validated |
| `openTrips/{tripId}` | any signed-in user | server only |
| `trips/{tripId}` | the trip's rider and its assigned driver | server only |
| `activeTrips/{uid}` | that user | server only |
| `tripHistory/{uid}/{tripId}` | that user | server only |
| `bannedUsers/{uid}` | nobody | server only |

`openTrips` is the public job board. It deliberately carries no rider identity and no
drop-off address — a driver sees the pickup point, the vehicle class, the distance and
the fare, and nothing else until they accept.

`activeTrips/{uid}` is what lets a rider or driver close the app mid-trip and come back
to the live trip instead of a blank screen.

## Trip lifecycle

```
createTrip  ->  requested  -> acceptTrip -> accepted -> startTrip -> in_progress -> completeTrip -> tripHistory
                    |                          |                         |
                cancelTrip                 cancelTrip               payment required
              (rider cancels)          (driver releases,           (Mobile Money or
                                        job goes back on             cash by driver)
                                          the board)
```

`completeTrip` refuses to run until `paymentStatus` is `successful` (Mobile Money) or
`cash` (marked by the driver). Finished and cancelled trips move to `tripHistory` for
both parties and leave `trips`, so the driver board stays small.

## Deploying

On Windows, use the scripts in `scripts/`:

```powershell
.\scripts\Sync-And-Verify.ps1     # pull, install, typecheck, lint, build
.\scripts\Deploy.ps1 -SetSecrets  # first deploy: prompts for each secret
.\scripts\Deploy.ps1              # after that
.\scripts\Repair-Encoding.ps1     # rewrites any BOM / UTF-16 file as clean UTF-8
```

Or by hand, in this order — rules before functions, functions before hosting,
because the new client calls `acceptTrip` / `startTrip` / `cancelTrip`:

```bash
npm run verify
firebase deploy --only database
firebase deploy --only functions
npm run build && firebase deploy --only hosting   # or push to Vercel
```

## Required server configuration

The admin callables (`adminLogin`, `adminListTrips`, `adminSetUserBan`, …) refuse every
request unless `ADMIN_USERNAME` and `ADMIN_PASSWORD` are both set. Set them before you
deploy:

```bash
firebase functions:secrets:set ADMIN_USERNAME
firebase functions:secrets:set ADMIN_PASSWORD
firebase functions:secrets:set MOMO_API_USER
firebase functions:secrets:set MOMO_API_KEY
firebase functions:secrets:set MOMO_SUBSCRIPTION_KEY
```

## Known limits

- Driver matching is a broadcast: every online driver within 15 km of the pickup who
  runs the matching vehicle class sees the job. There is no assignment or queueing.
- A driver stays `online` until they tap "Go offline". Riders stop seeing them 90
  seconds after their last position update, so a closed tab does not show as a
  bookable car, but the database row stays `online`.
- Stale `requested` trips expire after 15 minutes for display purposes; call
  `adminExpireStaleTrips` to actually clear them out of the database.
- Cash payment is marked by the driver on trust. There is no reconciliation.
