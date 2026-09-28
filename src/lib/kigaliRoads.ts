/**
 * Recognises Rwanda's road-code addresses (KN 4 Ave, KG 9 Ave, KK 15 Rd) typed
 * with no spaces or shorthand - "kn18st" - optionally followed by an area name
 * ("KN 4 Ave Kiyovu"). Google knows these codes once they are spaced out, so the
 * query is rewritten before it is sent. With no suffix typed, St, Ave and Rd are
 * all tried and the person picks the right one.
 */
const SUFFIXES: Record<string, string> = {
  st: "St", street: "St",
  ave: "Ave", av: "Ave", avenue: "Ave",
  rd: "Rd", road: "Rd",
};

const ROAD_CODE = /^(KN|KG|KK)\s*-?\s*(\d{1,3})(?!\d)\s*(?:(avenue|street|road|ave|av|st|rd)(?![a-z]))?\.?[\s,]*(.*)$/i;

export function isRoadCodeQuery(raw: string): boolean {
  return ROAD_CODE.test(raw.trim());
}

/** Spaced-out queries to send to the geocoder, e.g. "KN 18 St, Kigali, Rwanda". */
export function roadCodeQueries(raw: string): string[] {
  const m = raw.trim().match(ROAD_CODE);
  if (!m) return [];
  const prefix = m[1].toUpperCase();
  const number = m[2];
  const suffix = m[3] ? SUFFIXES[m[3].toLowerCase()] : null;
  const area = (m[4] || "").trim();
  const tail = area && !/kigali|rwanda/i.test(area) ? `${area}, Kigali, Rwanda` : "Kigali, Rwanda";
  const suffixes = suffix ? [suffix] : ["St", "Ave", "Rd"];
  return suffixes.map((s) => `${prefix} ${number} ${s}, ${tail}`);
}

/** A result only counts if its address actually contains the typed road code. */
export function roadCodeMatcher(raw: string): RegExp | null {
  const m = raw.trim().match(ROAD_CODE);
  if (!m) return null;
  return new RegExp(`\\b${m[1]}\\s*${m[2]}\\b`, "i");
}