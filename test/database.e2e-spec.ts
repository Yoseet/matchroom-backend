import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { User } from '../src/modules/accounts/domain/entities/user.entity.js';
import { UserSession } from '../src/modules/accounts/domain/entities/user-session.entity.js';
import { OneTimeToken } from '../src/modules/accounts/domain/entities/one-time-token.entity.js';
import { IdentityVerification } from '../src/modules/privacy/domain/entities/identity-verification.entity.js';
import { Property } from '../src/modules/properties/domain/entities/property.entity.js';

const EXPECTED_TABLES = [
  'amenities',
  'audit_logs',
  'auth_identities',
  'cities',
  'conversation_participants',
  'conversations',
  'favorite_properties',
  'housing_preference_amenities',
  'housing_preferences',
  'identity_verifications',
  'legal_acceptances',
  'lifestyle_profiles',
  'matches',
  'media_assets',
  'messages',
  'notification_preferences',
  'notifications',
  'one_time_tokens',
  'privacy_requests',
  'privacy_settings',
  'profiles',
  'properties',
  'property_amenities',
  'property_photos',
  'property_status_history',
  'push_devices',
  'reports',
  'roommate_preferences',
  'user_blocks',
  'user_interests',
  'user_preferred_zones',
  'user_sessions',
  'users',
  'zones',
];

describe('Database schema (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a healthy database connection', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'up',
    });
    expect(response.body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('contains every MVP table', async () => {
    const rows: Array<{ tablename: string }> = await dataSource.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'migrations'
      ORDER BY tablename
    `);

    expect(rows.map((row) => row.tablename)).toEqual(EXPECTED_TABLES);
  });

  it('registers all 34 TypeORM entities', () => {
    expect(dataSource.entityMetadatas).toHaveLength(EXPECTED_TABLES.length);
  });

  it('keeps sensitive columns out of default selects', () => {
    const expectations = [
      [User, 'passwordHash'],
      [UserSession, 'refreshTokenHash'],
      [OneTimeToken, 'tokenHash'],
      [IdentityVerification, 'providerReference'],
      [Property, 'addressExact'],
      [Property, 'locationExact'],
    ] as const;

    for (const [entity, property] of expectations) {
      const metadata = dataSource.getMetadata(entity);
      expect(metadata.findColumnWithPropertyName(property)?.isSelect).toBe(
        false,
      );
    }
  });

  it('enforces the users email uniqueness case-insensitively', async () => {
    await dataSource.query(
      `INSERT INTO users (email) VALUES ('CaseTest@Example.com')`,
    );

    await expect(
      dataSource.query(`INSERT INTO users (email) VALUES ('casetest@example.com')`),
    ).rejects.toMatchObject({ code: '23505' });

    await dataSource.query(`DELETE FROM users WHERE email = 'CaseTest@Example.com'`);
  });

  it('prevents a user from matching with themselves', async () => {
    const [{ id }]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO users (email) VALUES ('match-order@example.com') RETURNING id`,
    );

    await expect(
      dataSource.query(
        `INSERT INTO matches (user_a_id, user_b_id) VALUES ($1, $1)`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await dataSource.query(`DELETE FROM users WHERE id = $1`, [id]);
  });
});
