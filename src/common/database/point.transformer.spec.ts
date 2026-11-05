import { describe, expect, it } from 'vitest';
import { pointTransformer, type GeoPoint } from './point.transformer.js';

describe('pointTransformer', () => {
  it('serializes coordinates as (longitude,latitude)', () => {
    const point: GeoPoint = { latitude: 19.4326, longitude: -99.1332 };
    expect(pointTransformer.to!(point)).toBe('(-99.1332,19.4326)');
  });

  it('parses a PostgreSQL point value', () => {
    expect(pointTransformer.from!('(-99.1332,19.4326)')).toEqual({
      longitude: -99.1332,
      latitude: 19.4326,
    });
  });

  it('accepts scientific notation returned by PostgreSQL', () => {
    expect(pointTransformer.from!('(1e-05,-2.5e+01)')).toEqual({
      longitude: 0.00001,
      latitude: -25,
    });
  });

  it('keeps null and undefined values', () => {
    expect(pointTransformer.to!(null)).toBeNull();
    expect(pointTransformer.to!(undefined)).toBeUndefined();
    expect(pointTransformer.from!(null)).toBeNull();
  });

  it('rejects malformed points', () => {
    expect(() => pointTransformer.from!('not-a-point')).toThrow(
      /Invalid PostgreSQL point/,
    );
  });
});
