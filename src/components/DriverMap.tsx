import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { reverseGeocode } from "../lib/geocode";
import { fetchRoute } from "../lib/directions";
import type { TripRequest } from "../lib/trips";

interface Props {
  driverPos: { lat: number; lng: number } | null;
  openTrips: TripRequest[];
  activeTrip: TripRequest | null;
  onAccept: (tripId: string) => void;
}

export default function DriverMap({ driverPos, openTrips, activeTrip, onAccept }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const googleRef = useRef<typeof google | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const tripMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const tripInfoWindowsRef = useRef<Map<string, google.maps.InfoWindow>>(new Map());
  const activePickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const activeDestMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    loadGoogleMaps().then((google) => {
      googleRef.current = google;
      map.current = new google.maps.Map(mapContainer.current!, {
        center: driverPos ?? { lat: -1.9441, lng: 30.0619 },
        zoom: 13,
        streetViewControl: false,
        mapTypeControl: false,
      });
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const google = googleRef.current;
    if (!ready || !google || !map.current || !driverPos) return;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: driverPos,
        map: map.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#111827",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
        zIndex: 999,
      });
      map.current.setCenter(driverPos);
    } else {
      driverMarkerRef.current.setPosition(driverPos);
    }
  }, [ready, driverPos]);

  useEffect(() => {
    const google = googleRef.current;
    if (!ready || !google || !map.current) return;

    if (activeTrip) {
      tripMarkersRef.current.forEach((m) => m.setMap(null));
      tripMarkersRef.current.clear();
      tripInfoWindowsRef.current.forEach((iw) => iw.close());
      tripInfoWindowsRef.current.clear();
      return;
    }

    const currentIds = new Set(openTrips.map((t) => t.id));
    tripMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        tripMarkersRef.current.delete(id);
        tripInfoWindowsRef.current.get(id)?.close();
        tripInfoWindowsRef.current.delete(id);
      }
    });

    openTrips.forEach((trip) => {
      if (tripMarkersRef.current.has(trip.id)) return;

      const marker = new google.maps.Marker({
        position: trip.pickup,
        map: map.current!,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
        animation: google.maps.Animation.DROP,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-size:13px;min-width:180px;">
          <div style="font-weight:600;margin-bottom:4px;">${trip.tripType === "person" ? "Passenger" : "Goods delivery"}</div>
          <div style="color:#6b7280;margin-bottom:6px;">Loading address...</div>
          <div style="color:#6b7280;margin-bottom:6px;">${trip.distanceKm} km &middot; ${trip.price} RWF</div>
          <button id="accept-${trip.id}" style="background:#2563eb;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;width:100%;">Accept</button>
        </div>`,
      });

      marker.addListener("click", () => {
        infoWindow.open({ map: map.current!, anchor: marker });
        reverseGeocode(trip.pickup.lat, trip.pickup.lng).then((address) => {
          const el = infoWindow.getContent();
          if (typeof el !== "string") return;
          infoWindow.setContent(el.replace("Loading address...", address));
        });
      });

      infoWindow.addListener("domready", () => {
        document.getElementById(`accept-${trip.id}`)?.addEventListener("click", () => {
          onAccept(trip.id);
          infoWindow.close();
        });
      });

      tripMarkersRef.current.set(trip.id, marker);
      tripInfoWindowsRef.current.set(trip.id, infoWindow);
    });
  }, [ready, openTrips, activeTrip, onAccept]);

  useEffect(() => {
    const google = googleRef.current;
    if (!ready || !google || !map.current) return;

    activePickupMarkerRef.current?.setMap(null);
    activePickupMarkerRef.current = null;
    activeDestMarkerRef.current?.setMap(null);
    activeDestMarkerRef.current = null;
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;
    setEtaMin(null);

    if (!activeTrip) return;

    activePickupMarkerRef.current = new google.maps.Marker({
      position: activeTrip.pickup,
      map: map.current,
      label: { text: "P", color: "white", fontSize: "11px" },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#16a34a", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
    });

    activeDestMarkerRef.current = new google.maps.Marker({
      position: activeTrip.destination,
      map: map.current,
      label: { text: "D", color: "white", fontSize: "11px" },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#dc2626", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
    });

    const target = activeTrip.status === "accepted" ? activeTrip.pickup : activeTrip.destination;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(activeTrip.pickup);
    bounds.extend(activeTrip.destination);
    if (driverPos) bounds.extend(driverPos);
    map.current.fitBounds(bounds, 80);

    if (driverPos) {
      fetchRoute(google, [driverPos.lng, driverPos.lat], [target.lng, target.lat]).then((route) => {
        if (!route || !map.current) return;
        setEtaMin(route.durationMin);
        routeLineRef.current = new google.maps.Polyline({
          path: route.path,
          map: map.current,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        });
      });
    }
  }, [ready, activeTrip, driverPos]);

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
      {activeTrip && (
        <div className="absolute top-2 left-2 bg-white shadow px-3 py-1.5 rounded-lg text-sm font-medium">
          {activeTrip.status === "accepted"
            ? etaMin !== null ? `Heading to pickup \u2014 ${etaMin} min` : "Heading to pickup..."
            : etaMin !== null ? `To destination \u2014 ${etaMin} min` : "Trip in progress..."}
        </div>
      )}
      {!activeTrip && openTrips.length === 0 && (
        <div className="absolute top-2 left-2 bg-white shadow px-3 py-1.5 rounded-lg text-sm text-gray-500">
          Waiting for requests...
        </div>
      )}
    </div>
  );
}