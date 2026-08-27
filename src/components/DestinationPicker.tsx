import { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { reverseGeocode } from "../lib/geocode";
import AddressSearch from "./AddressSearch";
import type { GeocodeResult } from "../lib/geocode";

interface Props {
  title?: string;
  initialCenter?: { lat: number; lng: number } | null;
  confirmLabel?: string;
  onConfirm: (place: GeocodeResult) => void;
  onBack: () => void;
}

const KIGALI = { lat: -1.9441, lng: 30.0619 };

/**
 * Destination picker in the Uber pattern: the pin is fixed to the centre of the
 * screen and the map moves underneath it. The address underneath is reverse
 * geocoded from wherever the map settles, so the pin is always the answer.
 */
export default function DestinationPicker({
  title = "Set your destination",
  initialCenter,
  confirmLabel = "Confirm destination",
  onConfirm,
  onBack,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveAddress = useCallback((lat: number, lng: number) => {
    const seq = ++requestSeq.current;
    setResolving(true);
    reverseGeocode(lat, lng)
      .then((text) => {
        // A slow lookup for a pin the user has already dragged away from is stale.
        if (seq !== requestSeq.current) return;
        setAddress(text);
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      })
      .finally(() => {
        if (seq === requestSeq.current) setResolving(false);
      });
  }, []);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !container.current) return;
        const start = initialCenter ?? KIGALI;

        const map = new google.maps.Map(container.current, {
          center: start,
          zoom: 16,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          keyboardShortcuts: false,
        });
        mapRef.current = map;
        setCenter(start);
        resolveAddress(start.lat, start.lng);

        map.addListener("dragstart", () => setMoving(true));
        map.addListener("idle", () => {
          setMoving(false);
          const c = map.getCenter();
          if (!c) return;
          const next = { lat: c.lat(), lng: c.lng() };
          setCenter(next);
          if (idleTimer.current) clearTimeout(idleTimer.current);
          idleTimer.current = setTimeout(() => resolveAddress(next.lat, next.lng), 250);
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the map."));

    return () => {
      cancelled = true;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [initialCenter, resolveAddress]);

  function recenterToMe() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSearchSelect(place: GeocodeResult) {
    setSearchOpen(false);
    mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
    mapRef.current?.setZoom(17);
    setAddress(place.name);
  }

  function confirm() {
    if (!center) return;
    onConfirm({ name: address || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`, ...center });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="relative flex-1">
        <div ref={container} className="absolute inset-0" />

        {/* The pin never moves. The map does. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`flex flex-col items-center transition-transform duration-200 ${
              moving ? "-translate-y-2" : "translate-y-0"
            }`}
            style={{ transform: "translateY(-14px)" }}
          >
            <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center shadow-lg">
              <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />
            </div>
            <div className="w-[3px] h-4 bg-black rounded-b" />
            <div
              className={`w-3 h-1 rounded-full bg-black/25 transition-opacity ${
                moving ? "opacity-100" : "opacity-40"
              }`}
            />
          </div>
        </div>

        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute top-4 left-4 w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:bg-gray-100"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={recenterToMe}
          aria-label="Centre on my location"
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center active:bg-gray-100"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="7" />
            <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        {error && (
          <div className="absolute top-20 left-4 right-4 bg-red-100 text-red-700 text-sm px-3 py-2 rounded-lg shadow">
            {error}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-4 text-center border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-500 mt-0.5">Drag map to move pin</p>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          {searchOpen ? (
            <AddressSearch placeholder="Search for an address" onSelect={handleSearchSelect} />
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 bg-gray-100 rounded-lg px-4 py-3.5 text-left active:bg-gray-200"
            >
              <span className="w-3 h-3 bg-black rounded-[2px] shrink-0" />
              <span className={`flex-1 truncate ${resolving ? "text-gray-400" : "text-gray-900"}`}>
                {resolving ? "Locating..." : address || "Move the map to choose"}
              </span>
              <svg className="w-5 h-5 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          )}

          <button
            onClick={confirm}
            disabled={!center || resolving}
            className="w-full bg-black text-white rounded-lg py-4 text-lg font-semibold disabled:opacity-40 active:bg-gray-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
