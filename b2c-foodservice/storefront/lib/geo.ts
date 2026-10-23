const EARTH_RADIUS_KM = 6371.0088;
const KM_PER_MILE = 1.609344;

export interface LatLng { lat: number; lng: number }

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Both markets show miles (all stores are in New York City, D-035). */
export function formatDistance(km: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'mile',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(km / KM_PER_MILE);
}
