import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "../firebase";

/**
 * Turns a Firebase callable failure into something a user - or whoever is
 * reading a screenshot of it - can act on.
 *
 * The SDK reports "internal" for anything it cannot interpret, including a 404
 * for a function that was never deployed. That single word sent us chasing
 * pricing bugs that did not exist, so the code is always surfaced alongside a
 * plain explanation.
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

const EXPLANATIONS: Record<string, string> = {
  unauthenticated: "Please log in and try again.",
  "permission-denied": "You are not allowed to do that.",
  "invalid-argument": "Some of the details are not valid. Please check and try again.",
  "failed-precondition": "This cannot be done yet.",
  aborted: "Someone else got there first. Please try again.",
  "not-found": "That is no longer available.",
  "resource-exhausted": "Too many requests. Please wait a moment and try again.",
  unavailable: "The service is temporarily unreachable. Please try again shortly.",
  "deadline-exceeded": "That took too long. Please check your connection and try again.",
};

/** Codes that mean "nothing answered", as opposed to "your request was wrong". */
const UNDEPLOYED_CODES = new Set(["internal", "not-found", "unavailable", "unknown"]);

export function describeCallableError(err: unknown, action: string): CallableFailure {
  const code = codeOf(err);
  const serverMessage =
    err instanceof Error && err.message && !/^internal$/i.test(err.message) ? err.message : "";

  console.error(`[callable] ${action} failed`, { code, error: err });

  if (code === "internal" || code === "unknown") {
    return {
      code,
      looksUndeployed: true,
      message:
        `Could not ${action}. The server did not answer, which usually means the ` +
        `Cloud Functions are not deployed yet.`,
    };
  }

  return {
    code,
    looksUndeployed: UNDEPLOYED_CODES.has(code),
    message: serverMessage || EXPLANATIONS[code] || `Could not ${action}.`,
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
