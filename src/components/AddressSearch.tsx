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

  function handleSelect(place: GeocodeResult) {
    setQuery(place.name);
    setOpen(false);
    onSelect(place);
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="w-full border rounded px-3 py-2"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border rounded mt-1 shadow-lg max-h-60 overflow-y-auto">
          {results.map((place, i) => (
            <li
              key={i}
              onClick={() => handleSelect(place)}
              className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
            >
              {place.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
