import { DataSource } from 'typeorm';
import { dataSourceOptions } from './typeorm-options.js';

/**
 * DataSource used by the TypeORM CLI (migrations).
 * It shares the exact options used by the NestJS DatabaseModule.
 */
export const AppDataSource = new DataSource(dataSourceOptions);
