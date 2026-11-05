/**
 * Environment contract for the whole application.
 *
 * This file contains no credentials, hosts or ports. Real values live only in
 * `.env` (local) or in the process environment (CI / production).
 */
export type NodeEnvironment = 'development' | 'test' | 'production';

export interface Environment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  CORS_ORIGIN: string;

  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DB_SSL: boolean;
  DB_LOGGING: boolean;
  DB_MIGRATIONS_RUN: boolean;

  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_TTL_SECONDS: number;

  AUTH_MAX_FAILED_ATTEMPTS: number;
  AUTH_LOCK_MINUTES: number;
  PASSWORD_RESET_TTL_MINUTES: number;
  AUTH_RETURN_RESET_TOKEN: boolean;

  LEGAL_TERMS_VERSION: string;
  LEGAL_PRIVACY_VERSION: string;
}

function required(
  config: Record<string, unknown>,
  name: keyof Environment,
): string {
  const value = config[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function toPort(
  config: Record<string, unknown>,
  name: 'PORT' | 'DB_PORT',
): number {
  const raw = required(config, name);
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

function toBoolean(
  config: Record<string, unknown>,
  name:
    | 'DB_SSL'
    | 'DB_LOGGING'
    | 'DB_MIGRATIONS_RUN'
    | 'AUTH_RETURN_RESET_TOKEN',
): boolean {
  const raw = required(config, name).toLowerCase();
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`${name} must be either "true" or "false"`);
  }
  return raw === 'true';
}

function toPositiveInteger(
  config: Record<string, unknown>,
  name: keyof Environment,
  min = 1,
): number {
  const raw = required(config, name);
  const value = Number(raw);

  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}`);
  }
  return value;
}

function toSecret(
  config: Record<string, unknown>,
  name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET',
): string {
  const value = required(config, name);
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters long`);
  }
  return value;
}

function toNodeEnvironment(config: Record<string, unknown>): NodeEnvironment {
  const value = required(config, 'NODE_ENV');
  if (!['development', 'test', 'production'].includes(value)) {
    throw new Error('NODE_ENV must be development, test or production');
  }
  return value as NodeEnvironment;
}

/**
 * Validates and types the raw environment. It fails fast so the application
 * never starts with a partial or invalid configuration.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): Environment {
  return {
    NODE_ENV: toNodeEnvironment(config),
    PORT: toPort(config, 'PORT'),
    CORS_ORIGIN: required(config, 'CORS_ORIGIN'),

    DB_HOST: required(config, 'DB_HOST'),
    DB_PORT: toPort(config, 'DB_PORT'),
    DB_USERNAME: required(config, 'DB_USERNAME'),
    DB_PASSWORD: required(config, 'DB_PASSWORD'),
    DB_DATABASE: required(config, 'DB_DATABASE'),
    DB_SSL: toBoolean(config, 'DB_SSL'),
    DB_LOGGING: toBoolean(config, 'DB_LOGGING'),
    DB_MIGRATIONS_RUN: toBoolean(config, 'DB_MIGRATIONS_RUN'),

    JWT_ACCESS_SECRET: toSecret(config, 'JWT_ACCESS_SECRET'),
    JWT_ACCESS_TTL_SECONDS: toPositiveInteger(
      config,
      'JWT_ACCESS_TTL_SECONDS',
    ),
    JWT_REFRESH_SECRET: toSecret(config, 'JWT_REFRESH_SECRET'),
    JWT_REFRESH_TTL_SECONDS: toPositiveInteger(
      config,
      'JWT_REFRESH_TTL_SECONDS',
    ),

    AUTH_MAX_FAILED_ATTEMPTS: toPositiveInteger(
      config,
      'AUTH_MAX_FAILED_ATTEMPTS',
    ),
    AUTH_LOCK_MINUTES: toPositiveInteger(config, 'AUTH_LOCK_MINUTES'),
    PASSWORD_RESET_TTL_MINUTES: toPositiveInteger(
      config,
      'PASSWORD_RESET_TTL_MINUTES',
    ),
    AUTH_RETURN_RESET_TOKEN: toBoolean(config, 'AUTH_RETURN_RESET_TOKEN'),

    LEGAL_TERMS_VERSION: required(config, 'LEGAL_TERMS_VERSION'),
    LEGAL_PRIVACY_VERSION: required(config, 'LEGAL_PRIVACY_VERSION'),
  };
}
