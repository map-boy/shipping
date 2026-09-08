import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../lib/googleMapsLoader";
import { fetchRoute } from "../lib/directions";

interface Point {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  pickup: Point;
  dropoff: Point;
  /** Reported upward so the booking step can price the real road distance. */
  onRoute?: (route: { km: number; min: number }) => void;
  className?: string;
}

/**
 * Shows the two chosen points and the road between them, so a customer can see
 * that the pickup and drop-off are where they meant before they are quoted.
 *
 * Degrades to a plain list of the two places if Maps cannot load - the booking
 * must never depend on the map rendering.
 */
export default function RoutePreviewMap({ pickup, dropoff, onRoute, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<{ markers: google.maps.Marker[]; line: google.maps.Polyline | null }>({
    markers: [],
    line: null,
  });
  // Held in a ref so a new callback identity does not re-run the map effect and
  // refetch the route on every parent render.
  const onRouteRef = useRef(onRoute);
  useEffect(() => {
    onRouteRef.current = onRoute;
  }, [onRoute]);

  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState<{ km: number; min: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(async (google) => {
        if (cancelled || !container.current) return;

        const map =
          mapRef.current ??
          new google.maps.Map(container.current, {
            disableDefaultUI: true,
            gestureHandling: "cooperative",
            clickableIcons: false,
          });
        mapRef.current = map;

        // Clear anything from a previous pair of points.
        overlaysRef.current.markers.forEach((m) => m.setMap(null));
        overlaysRef.current.line?.setMap(null);
        overlaysRef.current = { markers: [], line: null };

        const start = new google.maps.Marker({
          position: { lat: pickup.lat, lng: pickup.lng },
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#000000",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2.5,
          },
          title: pickup.name,
        });
        const end = new google.maps.Marker({
          position: { lat: dropoff.lat, lng: dropoff.lng },
          map,
          label: { text: "B", color: "#ffffff", fontSize: "11px", fontWeight: "700" },
          title: dropoff.name,
        });
        overlaysRef.current.markers = [start, end];

        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: pickup.lat, lng: pickup.lng });
        bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });
        map.fitBounds(bounds, 40);

        const route = await fetchRoute(
          google,
          [pickup.lng, pickup.lat],
          [dropoff.lng, dropoff.lat]
        );
        if (cancelled || !route) return;

        overlaysRef.current.line = new google.maps.Polyline({
          path: route.path,
          map,
          strokeColor: "#000000",
          strokeOpacity: 0.85,
          strokeWeight: 4,
        });
        setSummary({ km: route.distanceKm, min: route.durationMin });
        onRouteRef.current?.({ km: route.distanceKm, min: route.durationMin });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, pickup.name, dropoff.lat, dropoff.lng, dropoff.name]);

  return (
    <div className={className}>
      {!failed && (
        <div
          ref={container}
          className="w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-surface border border-line"
        />
      )}

      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-ink shrink-0 mt-1.5" />
          <span className="text-sm min-w-0">{pickup.name}</span>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-ink shrink-0 mt-1.5" />
          <span className="text-sm min-w-0">{dropoff.name}</span>
        </div>
        {summary && (
          <p className="text-sm text-muted">
            {summary.km} km by road &middot; about {summary.min} min
          </p>
        )}
        {failed && (
          <p className="text-sm text-muted">
            The map could not load, but both points are set and the price below still applies.
          </p>
        )}
      </div>
    </div>
  );
}
