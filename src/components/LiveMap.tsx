import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { listenNearbyDrivers, type DriverLocation, type VehicleType } from "../lib/drivers";
import { listenToDriverLocation } from "../lib/trackDriver";
import { fetchRoute } from "../lib/directions";

const VEHICLE_OPTIONS: { value: VehicleType | "all"; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#2563eb" },
  { value: "standard", label: "Standard", color: "#16a34a" },
  { value: "car_hire", label: "Car hire", color: "#0891b2" },
  { value: "bus", label: "Bus", color: "#db2777" },
  { value: "truck", label: "Truck", color: "#ca8a04" },
  { value: "vip", label: "VIP", color: "#7c3aed" },
];

const CAR_ICON = `<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1m14-6a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M7 17v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1m13 0v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1M7 11h10" stroke="white" stroke-width="1.4" fill="none"/>`;

const VEHICLE_ICON_SVG: Record<VehicleType, string> = {
  standard: CAR_ICON,
  car_hire: CAR_ICON,
  bus: `<path fill="white" d="M4 4h16v11H4zM6 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 6h5v4H6zM13 6h5v4h-5z"/>`,
  truck: `<path fill="white" d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>`,
  vip: `<path fill="white" d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z"/>`,
};

function buildVehicleIcon(vehicleType: VehicleType, color: string, size = 36): google.maps.Icon {
  const inner = VEHICLE_ICON_SVG[vehicleType] || VEHICLE_ICON_SVG.standard;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2"/>
    <g transform="translate(10,10) scale(0.7)">${inner}</g>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

/**
 * Slides a marker to its new position and returns the frame handle so the caller
 * can cancel it. Without cancellation, two updates arriving inside one animation
 * leave two rAF loops fighting over setPosition, which reads as jitter.
 */
function animateMarkerTo(
  marker: google.maps.Marker,
  to: google.maps.LatLngLiteral,
  duration = 900
): number | null {
  const from = marker.getPosition();
  if (!from) {
    marker.setPosition(to);
    return null;
  }
  const fromLat = from.lat();
  const fromLng = from.lng();
  if (fromLat === to.lat && fromLng === to.lng) return null;
  const start = performance.now();
  let handle: number;

  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    // ease-out so the vehicle settles rather than stopping dead
    const e = 1 - (1 - t) * (1 - t);
    marker.setPosition({ lat: fromLat + (to.lat - fromLat) * e, lng: fromLng + (to.lng - fromLng) * e });
    if (t < 1) handle = requestAnimationFrame(step);
  }
  handle = requestAnimationFrame(step);
  return handle;
}

function straightLineKm(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

interface Props {
  onLocationChange?: (loc: [number, number]) => void;
  trackedDriverId?: string | null;
  /** Drop-off point. Drawn once a driver is assigned so the rider sees the whole leg. */
  destination?: { lat: number; lng: number } | null;
  /** Drives what the route is measured to: the rider before pickup, the destination after. */
  tripStatus?: "accepted" | "in_progress" | null;
  onRequestVehicle?: (vehicleType: VehicleType) => void;
  fullScreen?: boolean;
}

export default function LiveMap({
  onLocationChange,
  trackedDriverId,
  destination,
  tripStatus,
  onRequestVehicle,
  fullScreen,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const googleRef = useRef<typeof google | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const driverInfoWindowsRef = useRef<Map<string, google.maps.InfoWindow>>(new Map());
  const trackedMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const lastRouteFetchRef = useRef(0);
  const trackedAnimRef = useRef<number | null>(null);
  const userAnimRef = useRef<number | null>(null);

  // The driver subscription must not restart every time the rider's own GPS ticks,
  // so everything it reads that changes often lives in a ref instead of a dep.
  const userLocationRef = useRef<[number, number] | null>(null);
  const destinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const tripStatusRef = useRef<Props["tripStatus"]>(null);
  const followRef = useRef(true);
  /** Which leg the map has already framed, so each leg is fitted exactly once. */
  const fittedLegRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | "all">("all");
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverLocation[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [following, setFollowing] = useState(true);
  const [driverSeen, setDriverSeen] = useState(false);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    destinationRef.current = destination ?? null;
  }, [destination]);

  useEffect(() => {
    tripStatusRef.current = tripStatus ?? null;
  }, [tripStatus]);

  useEffect(() => {
    followRef.current = following;
  }, [following]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let watchId: number | null = null;

    loadGoogleMaps()
      .then((google) => {
        googleRef.current = google;
        map.current = new google.maps.Map(mapContainer.current!, {
          center: { lat: -1.9441, lng: 30.0619 },
          zoom: 13,
          minZoom: 6,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: !fullScreen,
          restriction: {
            latLngBounds: { north: 0.5, south: -4.5, east: 32.5, west: 27.5 },
            strictBounds: false,
          },
        });

        // Uber follows the car until you touch the map, then leaves you alone and
        // offers a recentre. Fighting the user's pan on every position update is
        // what made the map feel broken before.
        map.current.addListener("dragstart", () => setFollowing(false));

        if (!navigator.geolocation) {
          setError("Geolocation not supported by this browser.");
          return;
        }

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { longitude, latitude } = pos.coords;
            setUserLocation([longitude, latitude]);
            onLocationChange?.([longitude, latitude]);

            if (!userMarkerRef.current) {
              userMarkerRef.current = new google.maps.Marker({
                position: { lat: latitude, lng: longitude },
                map: map.current!,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: "#111827",
                  fillOpacity: 1,
                  strokeColor: "white",
                  strokeWeight: 2,
                },
              });
              map.current!.setCenter({ lat: latitude, lng: longitude });
            } else {
              if (userAnimRef.current !== null) cancelAnimationFrame(userAnimRef.current);
              userAnimRef.current = animateMarkerTo(userMarkerRef.current, { lat: latitude, lng: longitude });
            }
          },
          (err) => setError(err.message),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      })
      .catch((err) => setError(err.message));

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
    // Builds the map exactly once. fullScreen only picks the initial control layout and
    // onLocationChange is a stable setter from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userLocation || trackedDriverId) return;
    const [lng, lat] = userLocation;
    const unsubscribe = listenNearbyDrivers(lat, lng, 5, vehicleFilter, setNearbyDrivers);
    return unsubscribe;
  }, [userLocation, vehicleFilter, trackedDriverId]);

  useEffect(() => {
    const google = googleRef.current;
    if (!map.current || !google) return;

    if (trackedDriverId) {
      driverMarkersRef.current.forEach((marker) => marker.setMap(null));
      driverMarkersRef.current.clear();
      driverInfoWindowsRef.current.clear();
      return;
    }

    const currentIds = new Set(nearbyDrivers.map((d) => d.id));
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        driverMarkersRef.current.delete(id);
        driverInfoWindowsRef.current.delete(id);
      }
    });

    nearbyDrivers.forEach((driver) => {
      const color = VEHICLE_OPTIONS.find((v) => v.value === driver.vehicleType)?.color || "#2563eb";
      const existing = driverMarkersRef.current.get(driver.id);
      if (existing) {
        animateMarkerTo(existing, { lat: driver.lat, lng: driver.lng });
        return;
      }

      const marker = new google.maps.Marker({
        position: { lat: driver.lat, lng: driver.lng },
        map: map.current!,
        icon: buildVehicleIcon(driver.vehicleType, color),
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-size:14px;font-weight:600;text-transform:capitalize;">${driver.vehicleType}</div>
          <button id="request-${driver.id}" style="margin-top:8px;background:#2563eb;color:white;border:none;border-radius:8px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;width:100%;min-height:44px;">Request this vehicle</button>`,
      });

      infoWindow.addListener("domready", () => {
        const btn = document.getElementById(`request-${driver.id}`);
        btn?.addEventListener("click", () => {
          onRequestVehicle?.(driver.vehicleType);
          infoWindow.close();
        });
      });

      marker.addListener("click", () => infoWindow.open({ map: map.current!, anchor: marker }));

      driverMarkersRef.current.set(driver.id, marker);
      driverInfoWindowsRef.current.set(driver.id, infoWindow);
    });
  }, [nearbyDrivers, trackedDriverId, onRequestVehicle]);

  useEffect(() => {
    const google = googleRef.current;

    const clearTracking = () => {
      if (trackedAnimRef.current !== null) cancelAnimationFrame(trackedAnimRef.current);
      trackedAnimRef.current = null;
      trackedMarkerRef.current?.setMap(null);
      trackedMarkerRef.current = null;
      destMarkerRef.current?.setMap(null);
      destMarkerRef.current = null;
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
    };

    if (!trackedDriverId || !map.current || !google) {
      clearTracking();
      setRouteInfo(null);
      setDriverSeen(false);
      return;
    }

    const drawRouteTo = (from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral) => {
      const now = Date.now();
      if (now - lastRouteFetchRef.current < 4000) return;
      lastRouteFetchRef.current = now;

      fetchRoute(google, [from.lng, from.lat], [to.lng, to.lat]).then((route) => {
        if (!map.current) return;

        // fetchRoute swallows its own errors and resolves null, so the fallback
        // has to live here - a .catch() would never run.
        if (!route) {
          const km = straightLineKm(from, to);
          setRouteInfo({ distanceKm: Math.round(km * 10) / 10, durationMin: Math.max(1, Math.round(km * 3)) });
          return;
        }

        setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });

        if (!routeLineRef.current) {
          routeLineRef.current = new google.maps.Polyline({
            path: route.path,
            map: map.current,
            strokeColor: "#000000",
            strokeOpacity: 0.85,
            strokeWeight: 5,
          });
        } else {
          routeLineRef.current.setPath(route.path);
        }
      });
    };

    const unsubscribe = listenToDriverLocation(
      trackedDriverId,
      (loc) => {
        if (!loc || !map.current) return;
        const position = { lat: loc.lat, lng: loc.lng };
        setDriverSeen(true);

        if (!trackedMarkerRef.current) {
          trackedMarkerRef.current = new google.maps.Marker({
            position,
            map: map.current,
            icon: buildVehicleIcon(loc.vehicleType, "#000000", 40),
            zIndex: 900,
          });
        } else {
          if (trackedAnimRef.current !== null) cancelAnimationFrame(trackedAnimRef.current);
          trackedAnimRef.current = animateMarkerTo(trackedMarkerRef.current, position);
        }

        // Before pickup the rider watches the car come to them; once the trip is
        // under way the leg that matters is car -> drop-off.
        const dest = destinationRef.current;
        const rider = userLocationRef.current;
        const heading = tripStatusRef.current === "in_progress" ? dest : rider ? { lat: rider[1], lng: rider[0] } : null;

        if (dest) {
          if (!destMarkerRef.current) {
            destMarkerRef.current = new google.maps.Marker({
              position: dest,
              map: map.current,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#000000",
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2.5,
              },
              zIndex: 800,
            });
          } else {
            destMarkerRef.current.setPosition(dest);
          }
        }

        if (!heading) return;

        // One fit per leg to frame both ends, then follow by panning only. Calling
        // fitBounds on every update was what pinned the zoom and blocked panning.
        const legKey = `${trackedDriverId}:${tripStatusRef.current ?? ""}`;
        if (fittedLegRef.current !== legKey) {
          fittedLegRef.current = legKey;
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(position);
          bounds.extend(heading);
          map.current.fitBounds(bounds, 90);
        } else if (followRef.current) {
          map.current.panTo(position);
        }

        drawRouteTo(position, heading);
      },
      (err) => setError(err.message)
    );

    return () => {
      unsubscribe();
      clearTracking();
    };
    // Deliberately only trackedDriverId: the rider's own position, the destination
    // and the trip status are read from refs so a GPS tick cannot tear down the
    // subscription and destroy the vehicle marker mid-animation.
  }, [trackedDriverId]);

  const mapHeightClass = fullScreen ? "w-full h-full" : "relative w-full h-[240px] sm:h-[320px] md:h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-md";

  return (
    <div className={fullScreen ? "relative w-full h-full" : "w-full"}>
      {!trackedDriverId && (
        <div className={fullScreen ? "absolute top-3 left-3 right-3 z-20 flex gap-2 overflow-x-auto" : "flex gap-2 mb-3"}>
          {VEHICLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVehicleFilter(opt.value)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition min-h-[44px] shadow ${
                vehicleFilter === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className={mapHeightClass}>
        <div
          className={
            fullScreen
              ? "absolute inset-1 sm:inset-2 md:inset-3 rounded-2xl overflow-hidden border-2 border-white shadow-2xl ring-1 ring-black/10"
              : "relative w-full h-full rounded-2xl overflow-hidden border-2 border-white shadow-xl ring-1 ring-black/10"
          }
        >
          <div ref={mapContainer} className="w-full h-full" />

          <div className="pointer-events-none absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-cta rounded-tl-2xl" />
          <div className="pointer-events-none absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-cta rounded-tr-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-cta rounded-bl-2xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-cta rounded-br-2xl" />
        </div>
        {error && (
          <div className="absolute top-16 left-2 right-2 z-20 bg-red-100 text-red-700 text-sm px-3 py-2 rounded shadow">{error}</div>
        )}
      </div>

      {!trackedDriverId && (
        <p className={fullScreen ? "absolute bottom-3 left-3 z-20 bg-white shadow px-3 py-1.5 rounded-lg text-sm text-gray-600" : "mt-2 text-sm text-gray-600"}>
          {nearbyDrivers.length} {vehicleFilter === "all" ? "vehicle(s)" : vehicleFilter + "(s)"} nearby
        </p>
      )}
      {trackedDriverId && (
        <>
          <div
            className={
              fullScreen
                ? "absolute top-3 left-3 right-3 z-20 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.16)] px-4 py-3 rounded-xl"
                : "mt-2"
            }
          >
            {!driverSeen ? (
              <p className="text-sm text-muted">Waiting for your driver&apos;s location...</p>
            ) : (
              <>
                <p className="text-base font-semibold">
                  {tripStatus === "in_progress" ? "On the way to your destination" : "Your driver is on the way"}
                </p>
                <p className="text-sm text-muted">
                  {routeInfo
                    ? `${routeInfo.distanceKm} km \u00b7 about ${routeInfo.durationMin} min`
                    : "Measuring the route..."}
                </p>
              </>
            )}
          </div>

          {/* Only offered once the rider has panned away, so it never nags. */}
          {!following && (
            <button
              onClick={() => {
                setFollowing(true);
                const pos = trackedMarkerRef.current?.getPosition();
                if (pos && map.current) map.current.panTo(pos);
              }}
              className="absolute bottom-4 right-4 z-20 w-12 h-12 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.2)] flex items-center justify-center active:bg-surface"
              aria-label="Follow the vehicle"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="7" />
                <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}