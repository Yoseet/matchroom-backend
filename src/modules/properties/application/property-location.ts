import type { GeoPoint } from '../../../common/database/point.transformer.js';

const METERS_PER_DEGREE_LATITUDE = 111_320;
const MIN_RADIUS_METERS = 250;
const MAX_RADIUS_METERS = 350;

/**
 * Derives the public location from the exact one. The public point is moved a
 * random 250-350 m in any direction so the listing cannot be pinpointed from
 * the marker shown in searches and maps.
 */
export function approximatePublicLocation(exact: GeoPoint): GeoPoint {
  const distance =
    MIN_RADIUS_METERS + Math.random() * (MAX_RADIUS_METERS - MIN_RADIUS_METERS);
  const angle = Math.random() * Math.PI * 2;

  const latitudeRadians = (exact.latitude * Math.PI) / 180;
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LATITUDE * Math.cos(latitudeRadians);

  const latitudeDelta =
    (distance * Math.cos(angle)) / METERS_PER_DEGREE_LATITUDE;
  const longitudeDelta =
    (distance * Math.sin(angle)) /
    (Math.abs(metersPerDegreeLongitude) < 1 ? 1 : metersPerDegreeLongitude);

  return {
    latitude: clamp(exact.latitude + latitudeDelta, -90, 90),
    longitude: normalizeLongitude(exact.longitude + longitudeDelta),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLongitude(longitude: number): number {
  if (longitude > 180) {
    return longitude - 360;
  }
  if (longitude < -180) {
    return longitude + 360;
  }
  return longitude;
}
