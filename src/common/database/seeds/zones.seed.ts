import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSource, EntityManager } from 'typeorm';
import { City } from '../../../modules/catalog/domain/entities/index.js';
import { cityKey } from './cities.seed.js';

export interface ZoneSeedRecord {
  stateName: string;
  cityName: string;
  name: string;
  slug: string;
  postalCode: string | null;
}

interface ZonesFile {
  total: number;
  zones: ZoneSeedRecord[];
}

export interface ZoneSeedResult {
  total: number;
  seeded: number;
  skipped: number;
  cities: number;
}

interface ZoneRow {
  cityId: string;
  name: string;
  slug: string;
  postalCode: string | null;
}

const DATA_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
);

const ZONES_PATH = join(DATA_DIRECTORY, 'zones.json');

/**
 * Rows per INSERT. Keeps each statement small enough for PostgreSQL while
 * still loading the ~55k zones in a few seconds.
 */
const CHUNK_SIZE = 1_000;

export async function loadZones(path = ZONES_PATH): Promise<ZoneSeedRecord[]> {
  try {
    const file = JSON.parse(await readFile(path, 'utf8')) as ZonesFile;

    if (!Array.isArray(file.zones) || file.zones.length === 0) {
      throw new Error('el archivo no contiene zonas');
    }

    return file.zones;
  } catch (error) {
    throw new Error(
      `No se pudo leer ${path}. Ejecuta primero: node src/common/database/data/extract-zones.mjs`,
      { cause: error },
    );
  }
}

async function insertChunk(
  manager: EntityManager,
  chunk: readonly ZoneRow[],
): Promise<void> {
  await manager.query(
    `
      INSERT INTO zones (city_id, name, slug, postal_code)
      SELECT *
      FROM unnest($1::uuid[], $2::text[], $3::text[], $4::varchar[])
      ON CONFLICT (city_id, slug) DO UPDATE
        SET name = EXCLUDED.name,
            postal_code = EXCLUDED.postal_code
        WHERE zones.name IS DISTINCT FROM EXCLUDED.name
           OR zones.postal_code IS DISTINCT FROM EXCLUDED.postal_code
    `,
    [
      chunk.map((row) => row.cityId),
      chunk.map((row) => row.name),
      chunk.map((row) => row.slug),
      chunk.map((row) => row.postalCode),
    ],
  );
}

/**
 * Upserts zones by (cityId, slug).
 *
 * Existing zones are refreshed with the extracted name/postal code, so the
 * seeder can be re-run safely after regenerating `zones.json`.
 */
export async function seedZones(
  dataSource: DataSource,
  zones?: readonly ZoneSeedRecord[],
): Promise<ZoneSeedResult> {
  const records = zones ?? (await loadZones());

  return dataSource.transaction(async (manager) => {
    const cities = await manager.getRepository(City).find();
    const cityIds = new Map(
      cities.map((city) => [cityKey(city.stateName, city.name), city.id]),
    );

    const rows: ZoneRow[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const zone of records) {
      const cityId = cityIds.get(cityKey(zone.stateName, zone.cityName));

      if (!cityId) {
        skipped += 1;
        continue;
      }

      const key = `${cityId}\u0000${zone.slug}`;

      // A single INSERT cannot update the same conflict target twice.
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }

      seen.add(key);
      rows.push({
        cityId,
        name: zone.name,
        slug: zone.slug,
        postalCode: zone.postalCode,
      });
    }

    for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
      await insertChunk(manager, rows.slice(index, index + CHUNK_SIZE));
    }

    return {
      total: records.length,
      seeded: rows.length,
      skipped,
      cities: cityIds.size,
    };
  });
}
