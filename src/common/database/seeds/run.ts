import { env } from '../../../config/env.js';
import { AppDataSource } from '../data-source.js';
import { seedCatalog } from './catalog.seed.js';
import { seedTestAccounts } from './test-accounts.seed.js';

/**
 * `npm run seed:test`
 *
 * Seeds the launch catalog and, outside production, a seeker and a landlord
 * account with a known password for manual testing.
 */
async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const catalog = await seedCatalog(AppDataSource);
    console.log(
      `Catálogo listo: ciudad ${catalog.cityId} (${catalog.zones} zonas, ${catalog.amenities} amenidades).`,
    );

    if (env.NODE_ENV === 'production') {
      console.log('NODE_ENV=production: se omiten las cuentas de prueba.');
      return;
    }

    const accounts = await seedTestAccounts(AppDataSource);
    console.log(
      `Cuentas de prueba: ${accounts.created} creadas, ${accounts.existing} ya existentes.`,
    );
    console.log('  seeker@matchroom.test / TestPassword123');
    console.log('  landlord@matchroom.test / TestPassword123');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
