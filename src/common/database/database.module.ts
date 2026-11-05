import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from '../../config/env.js';
import { dataSourceOptions } from './typeorm-options.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      autoLoadEntities: true,
      // Migrations are executed explicitly, unless the environment opts in
      // to running them on boot (useful for container entrypoints).
      migrations: env.DB_MIGRATIONS_RUN
        ? dataSourceOptions.migrations
        : [],
      migrationsRun: env.DB_MIGRATIONS_RUN,
    }),
  ],
})
export class DatabaseModule {}
