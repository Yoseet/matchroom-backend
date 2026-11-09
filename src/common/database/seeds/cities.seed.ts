import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSource } from 'typeorm';
import { City } from '../../../modules/catalog/domain/entities/index.js';

export interface CitySeedRecord {
  name: string;
  stateName: string;
  countryCode: string;
}

interface CitiesFile {
  total: number;
  cities: CitySeedRecord[];
}

export interface CitySeedResult {
  total: number;
  created: number;
  existing: number;
}

const DATA_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
);

const CITIES_PATH = join(DATA_DIRECTORY, 'cities.json');

/** Stable key used to match a city without relying on its generated UUID. */
export function cityKey(stateName: string, name: string): string {
  return `${stateName}\u0000${name}`;
}

export async function loadCities(
  path = CITIES_PATH,
): Promise<CitySeedRecord[]> {
  try {
    const file = JSON.parse(await readFile(path, 'utf8')) as CitiesFile;

    if (!Array.isArray(file.cities) || file.cities.length === 0) {
      throw new Error('el archivo no contiene ciudades');
    }

    return file.cities;
  } catch (error) {
    throw new Error(
      `No se pudo leer ${path}. Ejecuta primero: node src/common/database/data/extract-cities.mjs`,
      { cause: error },
    );
  }
}

/**
 * Inserts every city that is not already present.
 *
 * `cities` has no unique constraint because the MVP originally seeded a single
 * launch city, so idempotency is enforced here by (stateName, name).
 */
export async function seedCities(
  dataSource: DataSource,
  cities?: readonly CitySeedRecord[],
): Promise<CitySeedResult> {
  const records = cities ?? (await loadCities());

  return dataSource.transaction(async (manager) => {
    const repository = manager.getRepository(City);
    const existing = await repository.find();
    const byKey = new Map(
      existing.map((city) => [cityKey(city.stateName, city.name), city]),
    );

    const pending = records.filter(
      (city) => !byKey.has(cityKey(city.stateName, city.name)),
    );

    if (pending.length > 0) {
      const saved = await repository.save(
        repository.create(
          pending.map((city) => ({
            name: city.name,
            stateName: city.stateName,
            countryCode: city.countryCode || 'MX',
          })),
        ),
        { chunk: 500 },
      );

      for (const city of saved) {
        byKey.set(cityKey(city.stateName, city.name), city);
      }
    }

    return {
      total: byKey.size,
      created: pending.length,
      existing: existing.length,
    };
  });
}
