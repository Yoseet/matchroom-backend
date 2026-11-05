import type { DataSource } from 'typeorm';
import {
  Amenity,
  City,
  Zone,
} from '../../../modules/catalog/domain/entities/index.js';
import { AMENITIES, LAUNCH_CITY, LAUNCH_ZONES } from './seed-data.js';

export interface CatalogSeedResult {
  cityId: string;
  zones: number;
  amenities: number;
}

/**
 * Idempotent catalog seeder: creates the launch city, its zones and the
 * reusable amenities. Safe to run on every environment and multiple times.
 */
export async function seedCatalog(
  dataSource: DataSource,
): Promise<CatalogSeedResult> {
  return dataSource.transaction(async (manager) => {
    const cityRepository = manager.getRepository(City);
    let city = await cityRepository.findOneBy({
      name: LAUNCH_CITY.name,
      stateName: LAUNCH_CITY.stateName,
    });

    if (!city) {
      city = await cityRepository.save(cityRepository.create(LAUNCH_CITY));
    }

    const zoneRepository = manager.getRepository(Zone);
    for (const zone of LAUNCH_ZONES) {
      await zoneRepository
        .createQueryBuilder()
        .insert()
        .values({ cityId: city.id, name: zone.name, slug: zone.slug })
        .orIgnore()
        .execute();
    }

    const amenityRepository = manager.getRepository(Amenity);
    for (const amenity of AMENITIES) {
      await amenityRepository
        .createQueryBuilder()
        .insert()
        .values(amenity)
        .orIgnore()
        .execute();
    }

    return {
      cityId: city.id,
      zones: LAUNCH_ZONES.length,
      amenities: AMENITIES.length,
    };
  });
}
