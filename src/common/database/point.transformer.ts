import type { ValueTransformer } from 'typeorm';

/**
 * Coordinates are stored with PostgreSQL's native `point` type so the MVP can
 * run on a stock PostgreSQL installation. The `point` column is GiST-indexed
 * and stores `(longitude, latitude)`.
 *
 * When PostGIS is available, swap the column type to `geography(Point,4326)`
 * and keep this transformer (PostGIS accepts/returns the same textual format).
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const POINT_PATTERN = /^\(\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*,\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*\)$/i;

export const pointTransformer: ValueTransformer = {
  to(value: GeoPoint | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    return `(${value.longitude},${value.latitude})`;
  },
  from(value: string | GeoPoint | null | undefined): GeoPoint | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;

    const match = POINT_PATTERN.exec(value.trim());
    if (!match) {
      throw new Error(`Invalid PostgreSQL point value: "${value}"`);
    }

    return {
      longitude: Number(match[1]),
      latitude: Number(match[2]),
    };
  },
};
