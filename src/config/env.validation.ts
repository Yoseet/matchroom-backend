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
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_HOURS: number;
  GOOGLE_CLIENT_ID: string | null;
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

function toPositiveInteger(config: Record<string, unknown>, name: 'SESSION_TTL_HOURS', fallback: number): number {
  const raw = config[name];
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1 || value > 24 * 90) {
    throw new Error(`${name} must be an integer between 1 and ${24 * 90}`);
  }
  return value;
}

function optional(config: Record<string, unknown>, name: keyof Environment): string | null {
  const value = config[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function toBoolean(
  config: Record<string, unknown>,
  name: 'DB_SSL' | 'DB_LOGGING' | 'DB_MIGRATIONS_RUN',
): boolean {
  const raw = required(config, name).toLowerCase();
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`${name} must be either "true" or "false"`);
  }
  return raw === 'true';
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
    SESSION_COOKIE_NAME: optional(config, 'SESSION_COOKIE_NAME') ?? 'matchroom_session',
    SESSION_TTL_HOURS: toPositiveInteger(config, 'SESSION_TTL_HOURS', 168),
    GOOGLE_CLIENT_ID: optional(config, 'GOOGLE_CLIENT_ID'),
  };
}
