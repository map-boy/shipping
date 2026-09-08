import { useState, useRef, useEffect, useCallback } from "react";
import { findPlaces, type GeocodeResult } from "../lib/geocode";
import { searchLocalPlaces, popularPlaces, type RwandaPlace } from "../lib/rwandaPlaces";

interface Props {
  placeholder: string;
  onSelect: (place: GeocodeResult) => void;
  autoFocus?: boolean;
}

export default function AddressSearch({ placeholder, onSelect, autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  const run = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    const seq = ++seqRef.current;
    setSearching(true);
    setError(null);
    try {
      const places = await findPlaces(trimmed);
      if (seq !== seqRef.current) return;
      setResults(places);
      setSearched(true);
      setOpen(true);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setResults([]);
      setSearched(true);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Address search is unavailable right now."
      );
    } finally {
      if (seq === seqRef.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    debounceRef.current = setTimeout(() => void run(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, run]);

  /**
   * Recommendations come from the built-in gazetteer first. They are computed
   * synchronously from the bundle, so they appear on the first keystroke and
   * keep working with no network and no Google. Google's own results are merged
   * in behind them when they arrive.
   */
  const local: RwandaPlace[] = query.trim() ? searchLocalPlaces(query, 6) : popularPlaces(6);

  const localAsResults: GeocodeResult[] = local.map((p) => ({
    name: `${p.name}${p.region && !p.name.includes(p.region) ? `, ${p.region}` : ""}`,
    lat: p.lat,
    lng: p.lng,
  }));

  const remote = query.trim() ? results : [];
  const seen = new Set(localAsResults.map((r) => r.name.toLowerCase()));
  const visibleResults = [
    ...localAsResults,
    ...remote.filter((r) => !seen.has(r.name.toLowerCase())),
  ].slice(0, 10);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(place: GeocodeResult) {
    setQuery(place.name);
    setOpen(false);
    onSelect(place);
  }

  return (
    <div className="relative" ref={containerRef}>
      <form
        onSubmit={(e) => {
          // On a phone the keyboard's Go key is the natural way to search, and
          // waiting for a debounce that may never produce suggestions is a trap.
          e.preventDefault();
          if (debounceRef.current) clearTimeout(debounceRef.current);
          void run(query);
        }}
      >
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
          }}
          onFocus={() => setOpen(true)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3.5 text-base"
        />
      </form>

      {searching && <p className="mt-1.5 text-sm text-gray-500">Searching...</p>}

      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}

      {open && visibleResults.length > 0 && (
        <ul className="absolute left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {!query.trim() && (
            <li className="px-4 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Popular places
            </li>
          )}
          {visibleResults.map((place, i) => (
            <li key={`${place.lat},${place.lng},${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(place)}
                className="w-full flex items-center gap-3 text-left px-4 py-3 text-base hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-0"
              >
                <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span className="min-w-0 truncate">{place.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !searching && searched && visibleResults.length === 0 && (
        <p className="mt-1.5 text-sm text-gray-500">
          Nothing found for that name. Try a district or a nearby landmark, or drag the map to
          the spot.
        </p>
      )}
    </div>
  );
}
