export interface LatLng {
  lat: number;
  lng: number;
}

function segmentKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export interface WalkablePath {
  totalKm: number;
  /** Position at a given distance along the path, clamped at both ends. */
  at: (km: number) => LatLng;
}

/**
 * Turns a road path into something that can be walked at a constant speed, so a
 * simulated vehicle follows the actual road geometry rather than a straight line.
 */
export function makeWalkablePath(path: LatLng[]): WalkablePath {
  if (path.length === 0) {
    const origin = { lat: 0, lng: 0 };
    return { totalKm: 0, at: () => origin };
  }
  if (path.length === 1) {
    return { totalKm: 0, at: () => path[0] };
  }

  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i += 1) {
    cumulative.push(cumulative[i - 1] + segmentKm(path[i - 1], path[i]));
  }
  const totalKm = cumulative[cumulative.length - 1];

  return {
    totalKm,
    at(km: number): LatLng {
      if (km <= 0) return path[0];
      if (km >= totalKm) return path[path.length - 1];

      // Cumulative distances are sorted, so binary search the containing segment.
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] <= km) lo = mid;
        else hi = mid;
      }

      const spanKm = cumulative[hi] - cumulative[lo];
      const t = spanKm === 0 ? 0 : (km - cumulative[lo]) / spanKm;
      return {
        lat: path[lo].lat + (path[hi].lat - path[lo].lat) * t,
        lng: path[lo].lng + (path[hi].lng - path[lo].lng) * t,
      };
    },
  };
}
