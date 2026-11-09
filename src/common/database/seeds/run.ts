import { AppDataSource } from '../data-source.js';
import { seedAmenities } from './amenities.seed.js';
import { loadCities, seedCities } from './cities.seed.js';
import { loadZones, seedZones } from './zones.seed.js';

type SeedTarget = 'cities' | 'zones' | 'amenities' | 'all';

function resolveTarget(args: readonly string[]): SeedTarget {
  const targets = args.filter((arg) => !arg.startsWith('-'));

  if (targets.length === 0) {
    return 'all';
  }

  if (
    targets.length === 1 &&
    (targets[0] === 'cities' ||
      targets[0] === 'zones' ||
      targets[0] === 'amenities' ||
      targets[0] === 'all')
  ) {
    return targets[0];
  }

  console.error('Uso: npm run seed -- [cities|zones|amenities|all]');
  process.exit(1);
}

async function main(): Promise<void> {
  const target = resolveTarget(process.argv.slice(2));

  await AppDataSource.initialize();

  try {
    if (target === 'cities' || target === 'all') {
      const cities = await loadCities();
      const result = await seedCities(AppDataSource, cities);

      console.log(
        `Ciudades: ${result.total} en total, ${result.created} nuevas, ` +
          `${result.existing} ya existentes.`,
      );
    }

    if (target === 'zones' || target === 'all') {
      const zones = await loadZones();
      const result = await seedZones(AppDataSource, zones);

      console.log(
        `Zonas: ${result.seeded} de ${result.total} cargadas, ` +
          `${result.skipped} omitidas (ciudad inexistente o slug duplicado).`,
      );
    }

    if (target === 'amenities' || target === 'all') {
      const result = await seedAmenities(AppDataSource);

      console.log(
        `Amenidades: ${result.total} en total, ${result.created} nuevas, ` +
          `${result.updated} actualizadas, ${result.removed} obsoletas eliminadas.`,
      );
    }
  } finally {
    await AppDataSource.destroy();
  }

  console.log('Seed completado.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
