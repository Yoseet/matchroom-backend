import { AppDataSource } from '../../../../common/database/data-source.js';
import { purgeExpiredDeletions } from '../services/accounts-maintenance.service.js';

/**
 * CLI entry point for the final anonymization step:
 *   npm run accounts:purge
 *
 * Schedule it daily (cron, Task Scheduler, container job). It is safe to run
 * repeatedly: only accounts past their deletion date are processed.
 */
async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const anonymized = await purgeExpiredDeletions(AppDataSource);
    console.log(
      `Cuentas anonimizadas: ${anonymized}. Ejecución: ${new Date().toISOString()}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

await main();
