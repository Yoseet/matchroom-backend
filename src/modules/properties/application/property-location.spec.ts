import { describe, expect, it } from 'vitest';
import { approximatePublicLocation } from './property-location.js';

function distanceInMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

describe('approximatePublicLocation', () => {
  it('moves the exact point roughly 300 metres', () => {
    const exact = { latitude: 19.432608, longitude: -99.133209 };
    const publicLocation = approximatePublicLocation(exact);

    expect(publicLocation).not.toEqual(exact);
    expect(distanceInMeters(exact, publicLocation)).toBeGreaterThan(200);
    expect(distanceInMeters(exact, publicLocation)).toBeLessThan(400);
  });

  it('keeps coordinates within valid ranges', () => {
    const publicLocation = approximatePublicLocation({
      latitude: 89.9999,
      longitude: 179.9999,
    });

    expect(publicLocation.latitude).toBeGreaterThanOrEqual(-90);
    expect(publicLocation.latitude).toBeLessThanOrEqual(90);
    expect(publicLocation.longitude).toBeGreaterThanOrEqual(-180);
    expect(publicLocation.longitude).toBeLessThanOrEqual(180);
  });
});
