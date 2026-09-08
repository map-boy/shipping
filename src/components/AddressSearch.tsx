import { useState, useRef, useEffect, useCallback } from "react";
import { findPlaces, type GeocodeResult } from "../lib/geocode";

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

  // An empty box shows nothing without having to clear state from inside an effect.
  const visibleResults = query.trim() ? results : [];

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

      {open && !searching && visibleResults.length > 0 && (
        <ul className="absolute left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {visibleResults.map((place, i) => (
            <li key={`${place.lat},${place.lng},${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(place)}
                className="w-full text-left px-4 py-3 text-base hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100 last:border-0"
              >
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !searching && !error && searched && visibleResults.length === 0 && (
        <p className="mt-1.5 text-sm text-gray-500">
          Nothing found for that name. Try a nearby landmark, or drag the map to the spot.
        </p>
      )}
    </div>
  );
}
