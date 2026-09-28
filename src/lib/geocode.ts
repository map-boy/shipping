import { loadGoogleMaps } from "./googleMapsLoader";
import { roadCodeQueries, roadCodeMatcher } from "./kigaliRoads";

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

const KIGALI_CENTER = { lat: -1.9441, lng: 30.0619 };
const KIGALI_RADIUS_M = 40000;

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK || !results || !results[0]) {
        resolve("Dropped pin on map");
        return;
      }
      resolve(results[0].formatted_address);
    });
  });
}

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
/**
 * Looks a typed address up with the Geocoder rather than Places.
 *
 * Places Autocomplete is not enabled on every API key - Google stopped offering
 * the legacy Places classes to new projects - so a key that renders maps fine can
 * still return no suggestions. Geocoding is the more widely enabled service, and
 * it also lets someone confirm a place they typed but never saw suggested.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        address: trimmed,
        componentRestrictions: { country: "RW" },
        bounds: new google.maps.LatLngBounds(
          { lat: KIGALI_CENTER.lat - 2.5, lng: KIGALI_CENTER.lng - 2.5 },
          { lat: KIGALI_CENTER.lat + 2.5, lng: KIGALI_CENTER.lng + 2.5 }
        ),
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results) {
          resolve([]);
          return;
        }
        resolve(
          results.slice(0, 6).map((r) => ({
            name: r.formatted_address,
            lat: r.geometry.location.lat(),
            lng: r.geometry.location.lng(),
          }))
        );
      }
    );
  });
}

/**
 * Road codes ("kn18st", "KG 11 Ave") go to the Geocoder first, rewritten into the
 * spaced form Google knows. Trying Places or a plain geocode first returned a
 * loose match or nothing, so the old fallback never ran. Everything else: Places
 * first, Geocoder as a fallback.
 */
export async function findPlaces(query: string): Promise<GeocodeResult[]> {
  const matcher = roadCodeMatcher(query);
  if (matcher) {
    const batches = await Promise.all(
      roadCodeQueries(query).map((q) => geocodeAddress(q).catch(() => [] as GeocodeResult[]))
    );
    const seen = new Set<string>();
    const hits = batches.flat().filter((r) => {
      if (!matcher.test(r.name) || seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
    if (hits.length > 0) return hits;
  }
  try {
    const viaPlaces = await searchPlaces(query);
    if (viaPlaces.length > 0) return viaPlaces;
  } catch {
    // Places unavailable on this key - fall through to the geocoder.
  }
  return await geocodeAddress(query);
}