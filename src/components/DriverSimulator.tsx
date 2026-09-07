import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { fetchRoute } from "../lib/directions";
import { publishDriverLocation, goOffline } from "../lib/drivers";
import { makeWalkablePath, type LatLng, type WalkablePath } from "../lib/simulateRoute";
import { VEHICLE_LABELS, type VehicleType } from "../lib/catalog";
import { devToolsEnabled } from "../lib/devTools";
import AddressSearch from "./AddressSearch";
import { useToast } from "../context/toast";

const KIGALI: LatLng = { lat: -1.9441, lng: 30.0619 };
const TICK_MS = 1500;

/**
 * Drives the signed-in driver's own `drivers/{uid}` record along a real road
 * route, so live tracking can be watched end to end without two phones and a car.
 *
 * It writes as the driver themselves, which is exactly what the database rules
 * allow - nothing here bypasses them, so what you see is the real path a rider's
 * app takes in production.
 */
export default function DriverSimulator() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authChecked, setAuthChecked] = useState(false);

  const [start, setStart] = useState<LatLng>(KIGALI);
  const [startName, setStartName] = useState("Kigali city centre");
  const [end, setEnd] = useState<LatLng | null>(null);
  const [endName, setEndName] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [coldChain, setColdChain] = useState(false);
  const [speedKmh, setSpeedKmh] = useState(30);

  const [running, setRunning] = useState(false);
  const [progressKm, setProgressKm] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const pathRef = useRef<WalkablePath | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const travelledRef = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  async function begin() {
    setError(null);
    if (!user) return;
    if (!end) {
      setError("Choose where the vehicle should drive to.");
      return;
    }

    setPreparing(true);
    try {
      const google = await loadGoogleMaps();
      const route = await fetchRoute(google, [start.lng, start.lat], [end.lng, end.lat]);
      if (!route || route.path.length < 2) {
        setError("Could not find a road route between those two points.");
        return;
      }

      const walkable = makeWalkablePath(route.path);
      pathRef.current = walkable;
      travelledRef.current = 0;
      setTotalKm(walkable.totalKm);
      setProgressKm(0);

      // Put the driver on the map at the start before moving, so a rider watching
      // sees the vehicle appear rather than pop in halfway along.
      await publishDriverLocation(user.uid, start.lat, start.lng, vehicleType, "online", coldChain);
      setRunning(true);

      timerRef.current = setInterval(() => {
        const path = pathRef.current;
        if (!path) return;

        travelledRef.current += (speedKmh / 3600) * (TICK_MS / 1000);
        const clamped = Math.min(travelledRef.current, path.totalKm);
        const pos = path.at(clamped);
        setProgressKm(clamped);

        publishDriverLocation(user.uid, pos.lat, pos.lng, vehicleType, "online", coldChain).catch((err) =>
          setError(err instanceof Error ? err.message : "Could not publish position.")
        );

        if (clamped >= path.totalKm) {
          stop();
          showToast("Simulated vehicle reached the destination.", "success");
        }
      }, TICK_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the simulation.");
    } finally {
      setPreparing(false);
    }
  }

  async function goOfflineNow() {
    stop();
    if (user) await goOffline(user.uid).catch(() => undefined);
    showToast("Simulated driver is offline.", "info");
  }

  if (!devToolsEnabled) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Not available</h1>
        <p className="text-muted">
          The driver simulator is a development tool. Run the app with{" "}
          <code className="bg-surface px-1.5 py-0.5 rounded">npm run dev</code>, or set{" "}
          <code className="bg-surface px-1.5 py-0.5 rounded">VITE_ENABLE_DEV_TOOLS=true</code> on a
          preview deployment.
        </p>
      </div>
    );
  }

  if (!authChecked) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-muted">Checking your session...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Driver simulator</h1>
        <p className="text-muted">Log in as the driver account you want to simulate.</p>
      </div>
    );
  }

  const pct = totalKm > 0 ? Math.min(100, (progressKm / totalKm) * 100) : 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div>
        <p className="eyebrow">Development tool</p>
        <h1 className="text-3xl font-bold mt-1">Driver simulator</h1>
        <p className="text-muted mt-2">
          Moves this account&apos;s vehicle along a real road route. Open{" "}
          <Link to="/ride" className="underline font-medium">
            /ride
          </Link>{" "}
          as the rider in another browser profile to watch it move.
        </p>
        <p className="text-sm text-muted mt-2">
          Signed in as <span className="font-mono">{user.email ?? user.uid}</span>
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-surface p-4">
        <div>
          <p className="eyebrow mb-2">Start</p>
          <AddressSearch
            placeholder="Where the vehicle starts"
            onSelect={(place) => {
              setStart({ lat: place.lat, lng: place.lng });
              setStartName(place.name);
            }}
          />
          <p className="text-sm text-muted mt-1.5 truncate">{startName}</p>
        </div>

        <div>
          <p className="eyebrow mb-2">Drive to</p>
          <AddressSearch
            placeholder="Where the vehicle drives to"
            onSelect={(place) => {
              setEnd({ lat: place.lat, lng: place.lng });
              setEndName(place.name);
            }}
          />
          <p className="text-sm text-muted mt-1.5 truncate">{endName || "Not chosen yet"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="eyebrow">Vehicle</span>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as VehicleType)}
              disabled={running}
              className="field bg-white mt-1.5"
            >
              {(Object.entries(VEHICLE_LABELS) as [VehicleType, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow">Speed (km/h)</span>
            <input
              type="number"
              min={5}
              max={120}
              value={speedKmh}
              onChange={(e) => setSpeedKmh(Math.max(5, Math.min(120, Number(e.target.value) || 30)))}
              disabled={running}
              className="field bg-white mt-1.5"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={coldChain}
            disabled={running}
            onChange={(e) => setColdChain(e.target.checked)}
            className="w-4 h-4"
          />
          Cold chain capable
        </label>
      </div>

      {running && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Driving</span>
            <span className="tabular-nums text-muted">
              {progressKm.toFixed(2)} / {totalKm.toFixed(2)} km
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        {running ? (
          <button onClick={stop} className="btn-secondary flex-1">
            Pause
          </button>
        ) : (
          <button onClick={begin} disabled={!end || preparing} className="btn-primary flex-1">
            {preparing ? "Finding route..." : progressKm > 0 ? "Resume" : "Start driving"}
          </button>
        )}
        <button onClick={goOfflineNow} className="btn-secondary flex-1">
          Go offline
        </button>
      </div>

      <p className="text-sm text-muted">
        The simulator writes as this driver, so the database rules apply unchanged. It does not
        create or accept trips &mdash; use the driver dashboard for that, then start the simulator to
        make the vehicle move.
      </p>
    </div>
  );
}
