import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { listenNearbyDrivers, type DriverLocation, type VehicleType } from "../lib/drivers";
import { listenToDriverLocation } from "../lib/trackDriver";
import { fetchRoute } from "../lib/directions";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const VEHICLE_OPTIONS: { value: VehicleType | "all"; label: string; color: string }[] = [
  { value: "all", label: "All", color: "#2563eb" },
  { value: "standard", label: "Standard", color: "#16a34a" },
  { value: "truck", label: "Truck", color: "#ca8a04" },
  { value: "vip", label: "VIP", color: "#7c3aed" },
];

const VEHICLE_ICONS: Record<VehicleType, string> = {
  standard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1m14-6a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M7 17v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1m13 0v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1M7 11h10" stroke="white" stroke-width="1.4" fill="none"/></svg>`,
  truck: `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`,
  vip: `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z"/></svg>`,
};

function createVehicleElement(vehicleType: VehicleType, color: string) {
  const el = document.createElement("div");
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "50%";
  el.style.background = color;
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
  el.style.border = "2px solid white";
  el.style.cursor = "pointer";
  el.innerHTML = VEHICLE_ICONS[vehicleType] || VEHICLE_ICONS.standard;
  return el;
}

function animateMarkerTo(marker: mapboxgl.Marker, to: [number, number], duration = 800) {
  const from = marker.getLngLat();
  const fromArr: [number, number] = [from.lng, from.lat];
  if (fromArr[0] === to[0] && fromArr[1] === to[1]) return;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    const lng = fromArr[0] + (to[0] - fromArr[0]) * t;
    const lat = fromArr[1] + (to[1] - fromArr[1]) * t;
    marker.setLngLat([lng, lat]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const ROUTE_SOURCE_ID = "route";
const ROUTE_LAYER_ID = "route-line";

interface Props {
  onLocationChange?: (loc: [number, number]) => void;
  trackedDriverId?: string | null;
  onRequestVehicle?: (vehicleType: VehicleType) => void;
}

export default function LiveMap({ onLocationChange, trackedDriverId, onRequestVehicle }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const driverMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const trackedMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteFetchRef = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | "all">("all");
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverLocation[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [30.0619, -1.9441],
      zoom: 13,
    });

    map.current.on("load", () => {
      mapLoadedRef.current = true;
      if (!map.current!.getSource(ROUTE_SOURCE_ID)) {
        map.current!.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
        });
        map.current!.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#dc2626", "line-width": 5, "line-opacity": 0.8 },
        });
      }
    });

    if (!navigator.geolocation) {
      setError("Geolocation not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        setUserLocation([longitude, latitude]);
        onLocationChange?.([longitude, latitude]);

        if (!userMarkerRef.current) {
          userMarkerRef.current = new mapboxgl.Marker({ color: "#111827" })
            .setLngLat([longitude, latitude])
            .addTo(map.current!);
          map.current!.setCenter([longitude, latitude]);
        } else {
          animateMarkerTo(userMarkerRef.current, [longitude, latitude]);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Nearby drivers (only shown when NOT tracking a specific driver)
  useEffect(() => {
    if (!userLocation || trackedDriverId) return;
    const [lng, lat] = userLocation;
    const unsubscribe = listenNearbyDrivers(lat, lng, 5, vehicleFilter, setNearbyDrivers);
    return unsubscribe;
  }, [userLocation, vehicleFilter, trackedDriverId]);

  useEffect(() => {
    if (!map.current) return;

    if (trackedDriverId) {
      driverMarkersRef.current.forEach((marker) => marker.remove());
      driverMarkersRef.current.clear();
      return;
    }

    const currentIds = new Set(nearbyDrivers.map((d) => d.id));
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkersRef.current.delete(id);
      }
    });

    nearbyDrivers.forEach((driver) => {
      const color = VEHICLE_OPTIONS.find((v) => v.value === driver.vehicleType)?.color || "#2563eb";
      const existing = driverMarkersRef.current.get(driver.id);
      if (existing) {
        animateMarkerTo(existing, [driver.lng, driver.lat]);
      } else {
        const el = createVehicleElement(driver.vehicleType, color);
        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="font-size:13px;font-weight:600;text-transform:capitalize;">${driver.vehicleType}</div>
           <button id="request-${driver.id}" style="margin-top:6px;background:#2563eb;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;">Request this vehicle</button>`
        );
        popup.on("open", () => {
          const btn = document.getElementById(`request-${driver.id}`);
          btn?.addEventListener("click", () => {
            onRequestVehicle?.(driver.vehicleType);
            popup.remove();
          });
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([driver.lng, driver.lat])
          .setPopup(popup)
          .addTo(map.current!);
        driverMarkersRef.current.set(driver.id, marker);
      }
    });
  }, [nearbyDrivers, trackedDriverId, onRequestVehicle]);

  // Track the single accepted driver with real route + smooth movement
  useEffect(() => {
    if (!trackedDriverId || !map.current) {
      trackedMarkerRef.current?.remove();
      trackedMarkerRef.current = null;
      setRouteInfo(null);
      if (mapLoadedRef.current && map.current?.getSource(ROUTE_SOURCE_ID)) {
        (map.current.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        });
      }
      return;
    }

    const unsubscribe = listenToDriverLocation(trackedDriverId, (loc) => {
      if (!loc || !map.current) return;
      const lngLat: [number, number] = [loc.lng, loc.lat];

      if (!trackedMarkerRef.current) {
        const el = createVehicleElement("standard", "#dc2626");
        trackedMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map.current);
      } else {
        animateMarkerTo(trackedMarkerRef.current, lngLat);
      }

      if (userLocation) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(lngLat);
        bounds.extend(userLocation);
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });

        const now = Date.now();
        if (now - lastRouteFetchRef.current > 4000) {
          lastRouteFetchRef.current = now;
          fetchRoute(lngLat, userLocation).then((route) => {
            if (!route || !map.current || !mapLoadedRef.current) return;
            const source = map.current.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
            source?.setData({ type: "Feature", properties: {}, geometry: route.geometry });
            setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });
          });
        }
      }
    });

    return () => {
      unsubscribe();
      trackedMarkerRef.current?.remove();
      trackedMarkerRef.current = null;
    };
  }, [trackedDriverId, userLocation]);

  return (
    <div className="w-full">
      {!trackedDriverId && (
        <div className="flex gap-2 mb-3">
          {VEHICLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVehicleFilter(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                vehicleFilter === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative w-full h-[500px] rounded-xl overflow-hidden">
        <div ref={mapContainer} className="w-full h-full" />
        {error && (
          <div className="absolute top-2 left-2 bg-red-100 text-red-700 text-sm px-3 py-1 rounded">{error}</div>
        )}
      </div>

      {!trackedDriverId && (
        <p className="mt-2 text-sm text-gray-600">
          {nearbyDrivers.length} {vehicleFilter === "all" ? "vehicle(s)" : vehicleFilter + "(s)"} nearby &mdash; tap a vehicle on the map to request it
        </p>
      )}
      {trackedDriverId && (
        <p className="mt-2 text-sm text-gray-600">
          Your driver is on the way{routeInfo ? ` &mdash; ${routeInfo.distanceKm} km, about ${routeInfo.durationMin} min away` : ""}.
        </p>
      )}
    </div>
  );
}