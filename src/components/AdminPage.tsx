/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { functions } from "../firebase";

const ADMIN_EMAIL = "techubwenge@gmail.com";

type Tab = "trips" | "drivers" | "bans" | "marketplace";

interface Props {
  user: User | null;
}

export default function AdminPage({ user }: Props) {
  const [tab, setTab] = useState<Tab>("trips");
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [bans, setBans] = useState<Record<string, any>>({});
  const [marketplace, setMarketplace] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = !!user && user.email?.toLowerCase() === ADMIN_EMAIL;

  async function refresh() {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === "trips") {
        const res = await httpsCallable<{}, { trips: any[] }>(functions, "adminListTrips")({});
        setTrips(res.data.trips);
      } else if (tab === "drivers") {
        const res = await httpsCallable<{}, { drivers: any[] }>(functions, "adminListDrivers")({});
        setDrivers(res.data.drivers);
      } else if (tab === "bans") {
        const res = await httpsCallable<{}, { bans: Record<string, any> }>(functions, "adminListBans")({});
        setBans(res.data.bans);
      } else if (tab === "marketplace") {
        const res = await httpsCallable(functions, "adminMarketplace")({});
        setMarketplace(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin request failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, allowed]);

  async function deleteTrip(tripId: string) {
    if (!confirm(`Delete trip ${tripId}?`)) return;
    await httpsCallable(functions, "adminDeleteTrip")({ tripId });
    refresh();
  }

  async function toggleBan(userId: string, banned: boolean) {
    await httpsCallable(functions, "adminSetUserBan")({ userId, banned, reason: banned ? "admin action" : undefined });
    refresh();
  }

  async function setDriverStatus(driverId: string, status: string) {
    await httpsCallable(functions, "adminSetDriverStatus")({ driverId, status });
    refresh();
  }

  async function runDispatchSweep() {
    await httpsCallable(functions, "adminDispatchSweep")({});
    refresh();
  }

  if (!user) {
    return <div className="max-w-md mx-auto mt-24 text-center text-muted">Sign in as the admin account to view this page.</div>;
  }
  if (!allowed) {
    return <div className="max-w-md mx-auto mt-24 text-center text-red-600">Not authorized.</div>;
  }

  const tabs: Tab[] = ["trips", "drivers", "bans", "marketplace"];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button onClick={runDispatchSweep} className="text-sm border rounded-full px-4 py-2 hover:bg-gray-100">
          Run dispatch sweep
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-ink font-semibold" : "border-transparent text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "trips" && !loading && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th>ID</th><th>Status</th><th>Rider</th><th>Driver</th><th>Price</th><th></th></tr></thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-1 font-mono text-xs">{t.id}</td>
                <td>{t.status}</td>
                <td className="font-mono text-xs">{t.riderId}</td>
                <td className="font-mono text-xs">{t.driverId || "-"}</td>
                <td>{t.price?.toLocaleString?.() ?? t.price} RWF</td>
                <td><button onClick={() => deleteTrip(t.id)} className="text-red-600 text-xs">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "drivers" && !loading && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th>ID</th><th>Vehicle</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="py-1 font-mono text-xs">{d.id}</td>
                <td>{d.vehicleType}</td>
                <td>{d.status}</td>
                <td className="space-x-2">
                  {["online", "busy", "offline"].map((s) => (
                    <button key={s} onClick={() => setDriverStatus(d.id, s)} className={`text-xs ${d.status === s ? "font-bold" : "text-muted"}`}>
                      {s}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "bans" && !loading && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th>User</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {Object.entries(bans).map(([uid, b]: [string, any]) => (
              <tr key={uid} className="border-t">
                <td className="py-1 font-mono text-xs">{uid}</td>
                <td>{b.reason}</td>
                <td><button onClick={() => toggleBan(uid, false)} className="text-xs text-cta">Unban</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "marketplace" && !loading && marketplace && (
        <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-[60vh]">
          {JSON.stringify(marketplace, null, 2)}
        </pre>
      )}
    </div>
  );
}
