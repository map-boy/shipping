import { loadGoogleMaps } from "./googleMapsLoader";

export interface RoadDistance {
  distanceKm: number;
  durationMin: number;
}

/**
 * Real road distance from Google's routing, not a straight line. The server
 * still recomputes and prefers this value over its own great-circle fallback
 * whenever it looks plausible (see quoteTruckFare/createTrip).
 */
export async function getRoadDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RoadDistance> {
  const google = await loadGoogleMaps();
  const service = new google.maps.DirectionsService();

  const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (res, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !res) {
          reject(new Error("Could not calculate the route."));
          return;
        }
        resolve(res);
      }
    );
  });

  const leg = result.routes[0]?.legs[0];
  if (!leg?.distance || !leg?.duration) {
    throw new Error("That route has no distance data.");
  }

  return {
    distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    durationMin: Math.round(leg.duration.value / 60),
  };
}