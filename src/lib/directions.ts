export interface RouteResult {
  path: google.maps.LatLngLiteral[];
  distanceKm: number;
  durationMin: number;
}

export async function fetchRoute(
  google: typeof window.google,
  from: [number, number],
  to: [number, number]
): Promise<RouteResult | null> {
  const service = new google.maps.DirectionsService();

  try {
    const result = await service.route({
      origin: { lat: from[1], lng: from[0] },
      destination: { lat: to[1], lng: to[0] },
      travelMode: google.maps.TravelMode.DRIVING,
    });

    const route = result.routes[0];
    const leg = route?.legs[0];
    if (!route || !leg) return null;

    const path = route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }));

    return {
      path,
      distanceKm: Math.round(((leg.distance?.value ?? 0) / 1000) * 10) / 10,
      durationMin: Math.round((leg.duration?.value ?? 0) / 60),
    };
  } catch {
    return null;
  }
}