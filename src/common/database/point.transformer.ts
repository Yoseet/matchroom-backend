import type { ValueTransformer } from 'typeorm';

/**
 * Coordinates are stored with PostgreSQL's native `point` type so the MVP can
 * run on a stock PostgreSQL installation. The `point` column is GiST-indexed
 * and stores `(longitude, latitude)`.
 *
 * `node-postgres` parses `point` values as `{ x, y }`, while PostGIS and the
 * textual representation use `(lng,lat)`. The transformer accepts both forms
 * so entity reads and raw query results expose the same `GeoPoint` shape.
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface PgPoint {
  x: number;
  y: number;
}

const POINT_PATTERN =
  /^\(\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*,\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*\)$/i;

function isPgPoint(value: unknown): value is PgPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof (value as PgPoint).x === 'number' &&
    typeof (value as PgPoint).y === 'number'
  );
}

function isGeoPoint(value: unknown): value is GeoPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'latitude' in value &&
    'longitude' in value &&
    typeof (value as GeoPoint).latitude === 'number' &&
    typeof (value as GeoPoint).longitude === 'number'
  );
}

export const pointTransformer: ValueTransformer = {
  to(value: GeoPoint | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    return `(${value.longitude},${value.latitude})`;
  },
  from(value: unknown): GeoPoint | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      const match = POINT_PATTERN.exec(value.trim());
      if (!match) {
        throw new Error(`Invalid PostgreSQL point value: "${value}"`);
      }

      return {
        longitude: Number(match[1]),
        latitude: Number(match[2]),
      };
    }

    if (isPgPoint(value)) {
      return { longitude: value.x, latitude: value.y };
    }

    if (isGeoPoint(value)) {
      return value;
    }

    throw new Error('Invalid PostgreSQL point value');
  },
};
