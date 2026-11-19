import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './env.validation.js';

const validEnvironment: Record<string, unknown> = {
  NODE_ENV: 'test',
  PORT: '3100',
  CORS_ORIGIN: 'http://localhost:5173',
  DB_HOST: 'database.internal',
  DB_PORT: '5432',
  DB_USERNAME: 'matchroom',
  DB_PASSWORD: 'super-secret',
  DB_DATABASE: 'matchroom_test',
  DB_SSL: 'true',
  DB_LOGGING: 'false',
  DB_MIGRATIONS_RUN: 'false',
};

function without(key: string): Record<string, unknown> {
  const copy = { ...validEnvironment };
  delete copy[key];
  return copy;
}

describe('validateEnvironment', () => {
  it('reads, coerces and types every value from the environment', () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      NODE_ENV: 'test',
      PORT: 3100,
      CORS_ORIGIN: 'http://localhost:5173',
      DB_HOST: 'database.internal',
      DB_PORT: 5432,
      DB_USERNAME: 'matchroom',
      DB_PASSWORD: 'super-secret',
      DB_DATABASE: 'matchroom_test',
      DB_SSL: true,
      DB_LOGGING: false,
      DB_MIGRATIONS_RUN: false,
      SESSION_COOKIE_NAME: 'matchroom_session',
      SESSION_TTL_HOURS: 168,
      GOOGLE_CLIENT_ID: null,
    });
  });

  it('does not provide a default database host', () => {
    expect(() => validateEnvironment(without('DB_HOST'))).toThrow(
      /DB_HOST/,
    );
  });

  it('does not provide a default password', () => {
    expect(() => validateEnvironment(without('DB_PASSWORD'))).toThrow(
      /DB_PASSWORD/,
    );
  });

  it('does not provide a default HTTP port', () => {
    expect(() => validateEnvironment(without('PORT'))).toThrow(/PORT/);
  });

  it('rejects an invalid port', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, DB_PORT: '70000' }),
    ).toThrow(/DB_PORT/);
  });

  it('rejects an invalid boolean', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, DB_SSL: 'yes' }),
    ).toThrow(/DB_SSL/);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'staging' }),
    ).toThrow(/NODE_ENV/);
  });

  it('rejects a wildcard CORS origin when cookies are enabled', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, CORS_ORIGIN: '*' }),
    ).toThrow(/CORS_ORIGIN/);
  });
});
