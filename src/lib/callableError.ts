import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "../firebase";
import { tr } from "../i18n/active";
import type { MsgKey } from "../i18n/messages";

/**
 * Turns a Firebase callable failure into something a user - or whoever is
 * reading a screenshot of it - can act on.
 *
 * The SDK reports "internal" for anything it cannot interpret, including a 404
 * for a function that was never deployed. That single word sent us chasing
 * pricing bugs that did not exist, so the code is always surfaced alongside a
 * plain explanation. Messages follow the language chosen in the switcher.
 */
export interface CallableFailure {
  message: string;
  code: string;
  /** True when the backend looks absent rather than the request being wrong. */
  looksUndeployed: boolean;
}

function codeOf(err: unknown): string {
  const code = (err as FunctionsError | undefined)?.code;
  if (typeof code === "string") return code.replace(/^functions\//, "");
  return "unknown";
}

const KNOWN_CODES = new Set([
  "unauthenticated",
  "permission-denied",
  "invalid-argument",
  "failed-precondition",
  "aborted",
  "not-found",
  "resource-exhausted",
  "unavailable",
  "deadline-exceeded",
]);

const ACTION_KEYS: Record<string, MsgKey> = {
  "calculate a price": "act.quote",
  "place the order": "act.order",
  "get a price": "act.getprice",
};

/** Codes that mean "nothing answered", as opposed to "your request was wrong". */
const UNDEPLOYED_CODES = new Set(["internal", "not-found", "unavailable", "unknown"]);

export function describeCallableError(err: unknown, action: string): CallableFailure {
  const code = codeOf(err);
  const serverMessage =
    err instanceof Error && err.message && !/^internal$/i.test(err.message) ? err.message : "";

  console.error(`[callable] ${action} failed`, { code, error: err });

  const what = ACTION_KEYS[action] ? tr(ACTION_KEYS[action]) : action;

  if (code === "internal" || code === "unknown") {
    return { code, looksUndeployed: true, message: tr("err.undeployed", { action: what }) };
  }

  return {
    code,
    looksUndeployed: UNDEPLOYED_CODES.has(code),
    message:
      serverMessage ||
      (KNOWN_CODES.has(code) ? tr(`err.${code}` as MsgKey) : tr("err.generic", { action: what })),
  };
}

/**
 * Asks the backend for its catalogue, which takes no arguments and touches no
 * data. If this fails too, the problem is the deployment rather than whatever
 * the user was trying to do.
 */
export async function backendReachable(): Promise<boolean> {
  try {
    await httpsCallable(functions, "getCatalog")({});
    return true;
  } catch (err) {
    console.error("[callable] backend probe failed", err);
    return false;
  }
}