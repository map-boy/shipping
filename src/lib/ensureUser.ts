import { signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Booking needs no login, but it still needs an identity.
 *
 * Every trip belongs to a rider: the database rules key trip access off the
 * uid, `activeTrips/{uid}` is how someone reconnects to a trip in progress, and
 * the driver reads the trip through the same rules. So instead of dropping the
 * account requirement we sign people in anonymously - no screen, no password,
 * but a real uid underneath.
 *
 * Requires the Anonymous provider to be enabled in Firebase Authentication.
 */
export async function ensureUser(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;

  // A page that has just loaded may have a session that is still restoring.
  const restored = await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        unsub();
        resolve(u);
      },
      () => {
        unsub();
        resolve(null);
      }
    );
  });
  if (restored) return restored;

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function isGuest(user: User | null): boolean {
  return !!user?.isAnonymous;
}
