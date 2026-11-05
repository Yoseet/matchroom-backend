import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { env } from '../../config/env.js';
import {
  AuthIdentity,
  LegalAcceptance,
  OneTimeToken,
  User,
  UserSession,
} from '../../modules/accounts/domain/entities/index.js';
import {
  Amenity,
  City,
  Zone,
} from '../../modules/catalog/domain/entities/index.js';
import {
  Conversation,
  ConversationParticipant,
  Message,
} from '../../modules/chat/domain/entities/index.js';
import {
  Match,
  UserInterest,
} from '../../modules/matching/domain/entities/index.js';
import { MediaAsset } from '../../modules/media/domain/entities/index.js';
import {
  AuditLog,
  Notification,
  NotificationPreference,
  PushDevice,
} from '../../modules/notifications/domain/entities/index.js';
import {
  IdentityVerification,
  PrivacyRequest,
  PrivacySetting,
} from '../../modules/privacy/domain/entities/index.js';
import {
  HousingPreference,
  HousingPreferenceAmenity,
  LifestyleProfile,
  Profile,
  RoommatePreference,
  UserPreferredZone,
} from '../../modules/profiles/domain/entities/index.js';
import {
  FavoriteProperty,
  Property,
  PropertyAmenity,
  PropertyPhoto,
  PropertyStatusHistory,
} from '../../modules/properties/domain/entities/index.js';
import { Report, UserBlock } from '../../modules/safety/domain/entities/index.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Explicit entity list.
 *
 * Importing the classes (instead of a filesystem glob) keeps TypeORM from
 * dynamically loading `.ts` files at runtime, which is fragile under test
 * runners, and gives the CLI complete metadata for every table.
 */
export const entities = [
  Amenity,
  City,
  Zone,
  User,
  AuthIdentity,
  UserSession,
  OneTimeToken,
  LegalAcceptance,
  MediaAsset,
  Profile,
  LifestyleProfile,
  RoommatePreference,
  HousingPreference,
  UserPreferredZone,
  HousingPreferenceAmenity,
  PrivacySetting,
  PrivacyRequest,
  IdentityVerification,
  Property,
  PropertyPhoto,
  PropertyAmenity,
  PropertyStatusHistory,
  FavoriteProperty,
  UserInterest,
  Match,
  Conversation,
  ConversationParticipant,
  Message,
  UserBlock,
  Report,
  Notification,
  NotificationPreference,
  PushDevice,
  AuditLog,
];

/**
 * Shared persistence configuration.
 *
 * Both the NestJS module and the TypeORM CLI use this object so there is a
 * single source of truth for the connection and for entity/migration paths.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  entities,
  migrations: [join(currentDirectory, 'migrations', '*.{ts,js}')],
  namingStrategy: new SnakeNamingStrategy(),
  logging: env.DB_LOGGING,
  synchronize: false,
  extra: {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
};
