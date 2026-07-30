import { useState, useRef, useEffect } from "react";
import { searchPlaces, type GeocodeResult } from "../lib/geocode";

interface Props {
  placeholder: string;
  onSelect: (place: GeocodeResult) => void;
}

export default function AddressSearch({ placeholder, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const places = await searchPlaces(query);
      setResults(places);
      setOpen(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

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
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="w-full border rounded-lg px-3 py-3 text-base"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border rounded mt-1 shadow-lg max-h-60 overflow-y-auto">
          {results.map((place, i) => (
            <li
              key={i}
              onClick={() => handleSelect(place)}
              className="px-4 py-3 text-sm active:bg-gray-100 cursor-pointer min-h-[44px] flex items-center"
            >
              {place.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
