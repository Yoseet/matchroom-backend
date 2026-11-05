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
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
  JWT_REFRESH_TTL_SECONDS: '604800',
  AUTH_MAX_FAILED_ATTEMPTS: '5',
  AUTH_LOCK_MINUTES: '15',
  PASSWORD_RESET_TTL_MINUTES: '60',
  AUTH_RETURN_RESET_TOKEN: 'false',
  LEGAL_TERMS_VERSION: '2026-11',
  LEGAL_PRIVACY_VERSION: '2026-11',
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
      JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
      JWT_REFRESH_TTL_SECONDS: 604800,
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCK_MINUTES: 15,
      PASSWORD_RESET_TTL_MINUTES: 60,
      AUTH_RETURN_RESET_TOKEN: false,
      LEGAL_TERMS_VERSION: '2026-11',
      LEGAL_PRIVACY_VERSION: '2026-11',
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

  it('rejects a JWT secret that is too short', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a non-positive numeric setting', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_TTL_SECONDS: '0',
      }),
    ).toThrow(/JWT_ACCESS_TTL_SECONDS/);
  });
});
