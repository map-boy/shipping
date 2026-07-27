export interface RouteLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteResult {
  geometry: RouteLineString;
  distanceKm: number;
  durationMin: number;
}

export async function fetchRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteResult | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      geometry: route.geometry,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}