export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];

  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${token}&proximity=30.0619,-1.9441&limit=5`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  return (data.features || []).map((f: any) => ({
    name: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}
