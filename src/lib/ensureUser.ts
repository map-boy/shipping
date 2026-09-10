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

  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (err) {
    throw new GuestSignInError(err);
  }
}

/**
 * Anonymous sign-in fails with auth/admin-restricted-operation when the
 * Anonymous provider is disabled in Firebase Authentication. That is a console
 * setting, not something the customer did, so the raw code must never reach
 * them - but it does need to reach the logs, or the cause is invisible.
 */
export class GuestSignInError extends Error {
  readonly code: string;

  constructor(cause: unknown) {
    const code =
      typeof (cause as { code?: unknown } | undefined)?.code === "string"
        ? ((cause as { code: string }).code)
        : "auth/unknown";

    super(
      code === "auth/admin-restricted-operation" || code === "auth/operation-not-allowed"
        ? "Guest checkout is not switched on for this site yet. Please log in, or contact us to order."
        : code === "auth/network-request-failed"
        ? "We could not reach the server. Check your connection and try again."
        : "We could not start your order. Please try again."
    );
    this.name = "GuestSignInError";
    this.code = code;
    console.error("[ensureUser] anonymous sign-in failed", { code, cause });
  }
}

export function isGuest(user: User | null): boolean {
  return !!user?.isAnonymous;
}
