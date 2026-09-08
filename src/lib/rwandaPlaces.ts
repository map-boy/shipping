/**
 * A built-in gazetteer of Rwandan places.
 *
 * Search suggestions used to come only from Google Places, which needs the Maps
 * script to load and the Places API to be enabled on the key. On a weak mobile
 * connection - or a key without Places - the box returned nothing and the flow
 * dead-ended. These entries ship inside the bundle, so recommendations appear
 * instantly, offline, and regardless of Google.
 *
 * Coordinates are approximate town, sector or landmark centres, good enough to
 * price a trip and to centre the map; the picker still lets the exact point be
 * dragged. `aliases` carry the older names people still type.
 */
export interface RwandaPlace {
  name: string;
  lat: number;
  lng: number;
  region: string;
  aliases?: string[];
  /** Lower sorts first among equally good matches. Default 5. */
  priority?: number;
}

export const RWANDA_PLACES: RwandaPlace[] = [
  // --- Kigali: sectors and landmarks people actually name ------------------
  { priority: 0, name: "Kigali city centre", lat: -1.9441, lng: 30.0619, region: "Kigali", aliases: ["downtown", "cbd", "town"] },
  { priority: 1, name: "Nyabugogo bus park", lat: -1.9403, lng: 30.0444, region: "Kigali", aliases: ["nyabugogo"] },
  { priority: 1, name: "Kigali International Airport", lat: -1.9686, lng: 30.1395, region: "Kigali", aliases: ["airport", "kanombe airport"] },
  { name: "Kigali Convention Centre", lat: -1.9536, lng: 30.0925, region: "Kigali", aliases: ["kcc", "convention"] },
  { name: "Kigali Heights", lat: -1.9542, lng: 30.0928, region: "Kigali" },
  { name: "Remera", lat: -1.9556, lng: 30.1122, region: "Kigali" },
  { name: "Kimironko", lat: -1.9333, lng: 30.1167, region: "Kigali" },
  { name: "Kacyiru", lat: -1.9333, lng: 30.0833, region: "Kigali" },
  { name: "Nyamirambo", lat: -1.9833, lng: 30.0333, region: "Kigali" },
  { name: "Gikondo", lat: -1.9833, lng: 30.0667, region: "Kigali" },
  { name: "Kicukiro centre", lat: -1.9833, lng: 30.1000, region: "Kigali", aliases: ["kicukiro"] },
  { name: "Gisozi", lat: -1.9167, lng: 30.0667, region: "Kigali" },
  { name: "Kinyinya", lat: -1.9000, lng: 30.1000, region: "Kigali" },
  { name: "Kanombe", lat: -1.9833, lng: 30.1500, region: "Kigali" },
  { name: "Masaka", lat: -2.0000, lng: 30.1833, region: "Kigali" },
  { name: "Kabuga", lat: -1.9500, lng: 30.2167, region: "Kigali" },
  { name: "Rebero", lat: -1.9944, lng: 30.0806, region: "Kigali" },
  { name: "Gacuriro", lat: -1.9139, lng: 30.0889, region: "Kigali" },
  { name: "Nyarutarama", lat: -1.9394, lng: 30.1006, region: "Kigali" },
  { name: "Gatenga", lat: -1.9922, lng: 30.0839, region: "Kigali" },
  { name: "Nyanza (Kicukiro)", lat: -2.0089, lng: 30.1042, region: "Kigali" },
  { name: "CHUK hospital", lat: -1.9506, lng: 30.0588, region: "Kigali", aliases: ["chuk", "university hospital"] },
  { name: "King Faisal Hospital", lat: -1.9539, lng: 30.0906, region: "Kigali", aliases: ["king faisal"] },
  { name: "Amahoro Stadium", lat: -1.9506, lng: 30.1058, region: "Kigali", aliases: ["amahoro"] },

  // --- Northern Province ---------------------------------------------------
  { priority: 1, name: "Musanze", lat: -1.4998, lng: 29.6350, region: "Northern", aliases: ["ruhengeri"] },
  { name: "Burera", lat: -1.4667, lng: 29.8500, region: "Northern", aliases: ["kidaho"] },
  { name: "Gicumbi", lat: -1.5794, lng: 30.0644, region: "Northern", aliases: ["byumba"] },
  { name: "Gakenke", lat: -1.6833, lng: 29.7833, region: "Northern" },
  { name: "Rulindo", lat: -1.7333, lng: 30.0500, region: "Northern" },
  { name: "Kinigi", lat: -1.4333, lng: 29.5833, region: "Northern" },
  { name: "Base", lat: -1.7667, lng: 30.0333, region: "Northern" },

  // --- Western Province ----------------------------------------------------
  { priority: 1, name: "Rubavu", lat: -1.6777, lng: 29.2588, region: "Western", aliases: ["gisenyi"] },
  { name: "Karongi", lat: -2.0603, lng: 29.3478, region: "Western", aliases: ["kibuye"] },
  { name: "Rusizi", lat: -2.4846, lng: 28.9075, region: "Western", aliases: ["cyangugu"] },
  { name: "Nyamasheke", lat: -2.3500, lng: 29.1333, region: "Western", aliases: ["kagano"] },
  { name: "Rutsiro", lat: -1.9167, lng: 29.3333, region: "Western" },
  { name: "Nyabihu", lat: -1.6500, lng: 29.5000, region: "Western", aliases: ["mukamira"] },
  { name: "Ngororero", lat: -1.8500, lng: 29.6167, region: "Western" },
  { name: "Kivumu", lat: -1.9833, lng: 29.4167, region: "Western" },

  // --- Southern Province ---------------------------------------------------
  { priority: 1, name: "Huye", lat: -2.5967, lng: 29.7394, region: "Southern", aliases: ["butare"] },
  { priority: 2, name: "Muhanga", lat: -2.0781, lng: 29.7561, region: "Southern", aliases: ["gitarama"] },
  { name: "Nyanza", lat: -2.3508, lng: 29.7411, region: "Southern" },
  { name: "Ruhango", lat: -2.1667, lng: 29.7833, region: "Southern" },
  { name: "Kamonyi", lat: -2.0167, lng: 29.9000, region: "Southern", aliases: ["gacurabwenge"] },
  { name: "Nyamagabe", lat: -2.4667, lng: 29.4667, region: "Southern", aliases: ["gikongoro"] },
  { name: "Nyaruguru", lat: -2.6000, lng: 29.5333, region: "Southern", aliases: ["kibeho"] },
  { name: "Gisagara", lat: -2.6167, lng: 29.8333, region: "Southern" },
  { name: "Nyabisindu", lat: -2.3500, lng: 29.7500, region: "Southern" },

  // --- Eastern Province ----------------------------------------------------
  { priority: 2, name: "Rwamagana", lat: -1.9487, lng: 30.4347, region: "Eastern" },
  { priority: 2, name: "Kayonza", lat: -1.8833, lng: 30.6167, region: "Eastern" },
  { name: "Ngoma", lat: -2.1667, lng: 30.5333, region: "Eastern", aliases: ["kibungo"] },
  { name: "Kirehe", lat: -2.2833, lng: 30.7167, region: "Eastern" },
  { priority: 2, name: "Nyagatare", lat: -1.2939, lng: 30.3272, region: "Eastern" },
  { name: "Gatsibo", lat: -1.5833, lng: 30.4167, region: "Eastern", aliases: ["kabarore"] },
  { name: "Bugesera", lat: -2.2500, lng: 30.1500, region: "Eastern" },
  { name: "Nyamata", lat: -2.1500, lng: 30.1000, region: "Eastern" },
  { name: "Rusumo", lat: -2.3833, lng: 30.7833, region: "Eastern" },
  { name: "Kagitumba", lat: -1.0500, lng: 30.4333, region: "Eastern" },
];

/** Lowercase, strip accents, collapse whitespace - so "Musanzé" matches "musanze". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface Scored {
  place: RwandaPlace;
  score: number;
}

/**
 * Ranks the gazetteer against a typed query. Lower score is better: an exact
 * name wins, then a name that starts with the query, then a matching alias,
 * then anything containing it.
 */
export function searchLocalPlaces(query: string, limit = 6): RwandaPlace[] {
  const q = normalize(query);
  if (q.length < 1) return [];

  const hits: Scored[] = [];

  for (const place of RWANDA_PLACES) {
    const name = normalize(place.name);
    let score: number | null = null;

    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.split(/[\s(]+/).some((word) => word.startsWith(q))) score = 2;
    else if (name.includes(q)) score = 4;

    if (score === null && place.aliases) {
      for (const alias of place.aliases) {
        const a = normalize(alias);
        if (a === q) { score = 1; break; }
        if (a.startsWith(q)) { score = 3; break; }
        if (a.includes(q)) { score = 5; break; }
      }
    }

    // Within a tier, prefer the places people actually travel to, then the
    // shorter name - so "nyanza" offers Nyanza before "Nyanza (Kicukiro)".
    if (score !== null) {
      hits.push({ place, score: score * 1000 + (place.priority ?? 5) * 50 + name.length });
    }
  }

  return hits
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((h) => h.place);
}

/** Popular starting points, offered before anything has been typed. */
export function popularPlaces(limit = 6): RwandaPlace[] {
  const wanted = [
    "Kigali city centre",
    "Nyabugogo bus park",
    "Kigali International Airport",
    "Musanze",
    "Rubavu",
    "Huye",
  ];
  return wanted
    .map((n) => RWANDA_PLACES.find((p) => p.name === n))
    .filter((p): p is RwandaPlace => !!p)
    .slice(0, limit);
}
