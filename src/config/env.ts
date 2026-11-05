import 'dotenv/config';
import { validateEnvironment } from './env.validation.js';

/**
 * Single point of access to configuration.
 *
 * `.env` is loaded here once. Every consumer (modules, TypeORM CLI, main.ts)
 * imports this object; no other file reads `process.env` for domain settings.
 */
export const env = validateEnvironment(
  process.env as Record<string, unknown>,
);

export { validateEnvironment } from './env.validation.js';
export type { Environment, NodeEnvironment } from './env.validation.js';
