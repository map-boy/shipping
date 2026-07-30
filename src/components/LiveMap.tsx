import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { listenNearbyDrivers, type DriverLocation, type VehicleType } from "../lib/drivers";
import { listenToDriverLocation } from "../lib/trackDriver";
import { fetchRoute } from "../lib/directions";

const VEHICLE_OPTIONS: { value: VehicleType | "all"; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#2563eb" },
  { value: "standard", label: "Standard", color: "#16a34a" },
  { value: "truck", label: "Truck", color: "#ca8a04" },
  { value: "vip", label: "VIP", color: "#7c3aed" },
];

const VEHICLE_ICON_SVG: Record<VehicleType, string> = {
  standard: `<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1m14-6a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M7 17v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1m13 0v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1M7 11h10" stroke="white" stroke-width="1.4" fill="none"/>`,
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

function animateMarkerTo(marker: google.maps.Marker, to: google.maps.LatLngLiteral, duration = 800) {
  const from = marker.getPosition();
  if (!from) {
    marker.setPosition(to);
    return;
  }
  const fromLat = from.lat();
  const fromLng = from.lng();
  if (fromLat === to.lat && fromLng === to.lng) return;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    marker.setPosition({ lat: fromLat + (to.lat - fromLat) * t, lng: fromLng + (to.lng - fromLng) * t });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

interface Props {
  onLocationChange?: (loc: [number, number]) => void;
  trackedDriverId?: string | null;
  onRequestVehicle?: (vehicleType: VehicleType) => void;
  fullScreen?: boolean;
}

export default function LiveMap({ onLocationChange, trackedDriverId, onRequestVehicle, fullScreen }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const googleRef = useRef<typeof google | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const driverInfoWindowsRef = useRef<Map<string, google.maps.InfoWindow>>(new Map());
  const trackedMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const lastRouteFetchRef = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | "all">("all");
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverLocation[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let watchId: number | null = null;

    loadGoogleMaps()
      .then((google) => {
        googleRef.current = google;
        map.current = new google.maps.Map(mapContainer.current!, {
          center: { lat: -1.9441, lng: 30.0619 },
          zoom: 13,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: !fullScreen,
        });

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
              animateMarkerTo(userMarkerRef.current, { lat: latitude, lng: longitude });
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
    if (!trackedDriverId || !map.current || !google) {
      trackedMarkerRef.current?.setMap(null);
      trackedMarkerRef.current = null;
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      setRouteInfo(null);
      return;
    }

    const unsubscribe = listenToDriverLocation(trackedDriverId, (loc) => {
      if (!loc || !map.current) return;
      const position = { lat: loc.lat, lng: loc.lng };

      if (!trackedMarkerRef.current) {
        trackedMarkerRef.current = new google.maps.Marker({
          position,
          map: map.current,
          icon: buildVehicleIcon("standard", "#dc2626"),
        });
      } else {
        animateMarkerTo(trackedMarkerRef.current, position);
      }

      if (userLocation) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(position);
        bounds.extend({ lat: userLocation[1], lng: userLocation[0] });

        const listener = google.maps.event.addListener(map.current, "bounds_changed", () => {
          if ((map.current!.getZoom() ?? 0) > 15) map.current!.setZoom(15);
          google.maps.event.removeListener(listener);
        });
        map.current.fitBounds(bounds, 80);

        const now = Date.now();
        if (now - lastRouteFetchRef.current > 4000) {
          lastRouteFetchRef.current = now;
          fetchRoute(google, [position.lng, position.lat], [userLocation[0], userLocation[1]])
            .then((route) => {
              if (!route || !map.current) return;

              setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });

              const path = route.path;

              if (!routeLineRef.current) {
                routeLineRef.current = new google.maps.Polyline({
                  path,
                  map: map.current,
                  strokeColor: "#2563eb",
                  strokeOpacity: 0.9,
                  strokeWeight: 5,
                });
              } else {
                routeLineRef.current.setPath(path);
              }
            })
            .catch(() => {
              const [dLng, dLat] = [position.lng - userLocation[0], position.lat - userLocation[1]];
              const distanceKm = Math.sqrt(dLng * dLng + dLat * dLat) * 111;
              setRouteInfo({ distanceKm: Math.round(distanceKm * 10) / 10, durationMin: Math.round(distanceKm * 3) });
            });
        }
      }
    });

    return () => {
      unsubscribe();
      trackedMarkerRef.current?.setMap(null);
      trackedMarkerRef.current = null;
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
    };
  }, [trackedDriverId, userLocation]);

  const mapHeightClass = fullScreen ? "w-full h-full" : "relative w-full h-[320px] rounded-xl overflow-hidden";

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
        <div ref={mapContainer} className="w-full h-full" />
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
        <p className={fullScreen ? "absolute top-3 left-3 right-3 z-20 bg-white shadow px-3 py-2 rounded-lg text-sm text-gray-600" : "mt-2 text-sm text-gray-600"}>
          Your driver is on the way{routeInfo ? ` \u2014 ${routeInfo.distanceKm} km, about ${routeInfo.durationMin} min away` : ""}.
        </p>
      )}
    </div>
  );
}