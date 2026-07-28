import { loadGoogleMaps } from "./googleMapsLoader";

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

const KIGALI_CENTER = { lat: -1.9441, lng: 30.0619 };
const KIGALI_RADIUS_M = 40000;

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const google = await loadGoogleMaps();
  const autocomplete = new google.maps.places.AutocompleteService();

  const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
    autocomplete.getPlacePredictions(
      {
        input: trimmed,
        componentRestrictions: { country: "rw" },
        locationBias: {
          center: KIGALI_CENTER,
          radius: KIGALI_RADIUS_M,
        } as google.maps.CircleLiteral,
      },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          resolve([]);
          return;
        }
        resolve(results);
      }
    );
  });

  if (predictions.length === 0) return [];

  const placesService = new google.maps.places.PlacesService(document.createElement("div"));

  const details = await Promise.all(
    predictions.slice(0, 6).map(
      (pred) =>
        new Promise<GeocodeResult | null>((resolve) => {
          placesService.getDetails(
            { placeId: pred.place_id, fields: ["name", "formatted_address", "geometry"] },
            (place, status) => {
              if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
                resolve(null);
                return;
              }
              resolve({
                name: place.formatted_address || place.name || pred.description,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
            }
          );
        })
    )
  );

  return details.filter((d): d is GeocodeResult => d !== null);
}