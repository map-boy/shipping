import { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { updateProfile, type User } from "firebase/auth";
import { db } from "../firebase";

interface ProfileProps {
  user: User | null;
  onLogoutClick: () => void;
}

export default function Profile({ user, onLogoutClick }: ProfileProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    get(ref(db, `users/${user.uid}`))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.val();
        setName(data?.name ?? user.displayName ?? "");
        setPhone(data?.phone ?? "");
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loading = !!user && !loaded;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      await set(ref(db, `users/${user.uid}`), {
        name,
        phone,
        email: user.email ?? null,
        updatedAt: Date.now(),
      });
      if (name && name !== user.displayName) {
        await updateProfile(user, { displayName: name });
      }
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <section className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-500">Please log in to view and edit your profile.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="max-w-xl mx-auto px-4 py-20 text-center text-gray-500">
        Loading profile...
      </section>
    );
  }

  return (
    <section className="max-w-xl mx-auto px-4 py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <button
          onClick={onLogoutClick}
          className="text-sm text-red-500 hover:text-red-600 font-medium border border-red-200 hover:bg-red-50 rounded-full px-4 py-2 transition"
        >
          Log out
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={user.email ?? ""}
            disabled
            className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-3 text-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+250 7XX XXX XXX"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 text-gray-800"
          />
        </div>

        {message && (
          <div className="text-sm rounded-lg px-3 py-2 bg-green-50 text-green-700">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-cta hover:bg-ctaHover text-white font-semibold py-3.5 rounded-lg transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
