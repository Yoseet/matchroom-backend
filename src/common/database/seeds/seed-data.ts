import type { UserActiveMode } from '../../../modules/accounts/domain/entities/index.js';
import type { LookingFor } from '../../../modules/profiles/domain/entities/index.js';

/**
 * Reference data for the launch city.
 *
 * Seeded both by the `SeedCatalogData` migration (production-safe) and by the
 * `seed:test` script. Keeping it here avoids hard-coding strings in services.
 */
export const LAUNCH_CITY = {
  name: 'Ciudad de México',
  stateName: 'Ciudad de México',
  countryCode: 'MX',
} as const;

export const LAUNCH_ZONES = [
  { name: 'Roma Norte', slug: 'roma-norte' },
  { name: 'Condesa', slug: 'condesa' },
  { name: 'Del Valle', slug: 'del-valle' },
  { name: 'Narvarte', slug: 'narvarte' },
  { name: 'Coyoacán', slug: 'coyoacan' },
  { name: 'Polanco', slug: 'polanco' },
  { name: 'Escandón', slug: 'escandon' },
  { name: 'Santa Fe', slug: 'santa-fe' },
  { name: 'Centro Histórico', slug: 'centro-historico' },
  { name: 'Doctores', slug: 'doctores' },
] as const;

export const AMENITIES = [
  { code: 'agua', name: 'Agua' },
  { code: 'luz', name: 'Luz' },
  { code: 'gas', name: 'Gas' },
  { code: 'internet', name: 'Internet' },
  { code: 'lavadora', name: 'Lavadora' },
  { code: 'estacionamiento', name: 'Estacionamiento' },
  { code: 'amueblado', name: 'Amueblado' },
  { code: 'cocina', name: 'Cocina equipada' },
  { code: 'elevador', name: 'Elevador' },
  { code: 'seguridad', name: 'Seguridad 24/7' },
  { code: 'mascotas', name: 'Mascotas permitidas' },
  { code: 'aire_acondicionado', name: 'Aire acondicionado' },
] as const;

export interface TestAccountSeed {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  activeMode: UserActiveMode;
  lookingFor: LookingFor;
}

/**
 * Accounts created by `npm run seed:test`. They must never be created in
 * production; `seedTestAccounts` enforces that.
 */
export const TEST_ACCOUNTS: readonly TestAccountSeed[] = [
  {
    email: 'seeker@matchroom.test',
    password: 'TestPassword123',
    firstName: 'Buscador',
    lastName: 'Prueba',
    birthDate: '1995-06-15',
    activeMode: 'seeker',
    lookingFor: 'both',
  },
  {
    email: 'landlord@matchroom.test',
    password: 'TestPassword123',
    firstName: 'Arrendador',
    lastName: 'Prueba',
    birthDate: '1988-03-20',
    activeMode: 'landlord',
    lookingFor: 'housing',
  },
];
