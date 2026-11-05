import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { seedCatalog } from '../src/common/database/seeds/catalog.seed.js';
import {
  AMENITIES,
  LAUNCH_ZONES,
  type TestAccountSeed,
} from '../src/common/database/seeds/seed-data.js';
import { seedTestAccounts } from '../src/common/database/seeds/test-accounts.seed.js';

const RUN_ID = randomUUID().slice(0, 8);

describe('Seeders (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await dataSource.query(
        'DELETE FROM users WHERE email = ANY($1::citext[])',
        [createdEmails],
      );
    }
    await app.close();
  });

  it('seeds the launch catalog idempotently', async () => {
    const first = await seedCatalog(dataSource);
    const second = await seedCatalog(dataSource);

    expect(second.cityId).toBe(first.cityId);

    const [zones] = await dataSource.query<Array<{ count: number }>>(
      `
        SELECT count(*)::int AS count
        FROM zones
        WHERE city_id = $1 AND slug = ANY($2::text[])
      `,
      [first.cityId, LAUNCH_ZONES.map((zone) => zone.slug)],
    );
    const [amenities] = await dataSource.query<Array<{ count: number }>>(
      `
        SELECT count(*)::int AS count
        FROM amenities
        WHERE code = ANY($1::text[])
      `,
      [AMENITIES.map((amenity) => amenity.code)],
    );

    expect(zones.count).toBe(LAUNCH_ZONES.length);
    expect(amenities.count).toBe(AMENITIES.length);
  });

  it('creates login-capable test accounts without duplicating them', async () => {
    const email = `e2e-seed-${RUN_ID}-seeker@matchroom.test`;
    createdEmails.push(email);

    const accounts: TestAccountSeed[] = [
      {
        email,
        password: 'TestPassword123',
        firstName: 'Buscador',
        lastName: 'Prueba',
        birthDate: '1995-06-15',
        activeMode: 'seeker',
        lookingFor: 'both',
      },
    ];

    const first = await seedTestAccounts(dataSource, accounts);
    const second = await seedTestAccounts(dataSource, accounts);

    expect(first).toEqual({ created: 1, existing: 0 });
    expect(second).toEqual({ created: 0, existing: 1 });

    const [related] = await dataSource.query<
      Array<{ profiles: number; privacy: number; legal: number }>
    >(
      `
        SELECT
          (SELECT count(*)::int FROM profiles WHERE user_id = users.id) AS profiles,
          (SELECT count(*)::int FROM privacy_settings WHERE user_id = users.id) AS privacy,
          (SELECT count(*)::int FROM legal_acceptances WHERE user_id = users.id) AS legal
        FROM users
        WHERE email = $1
      `,
      [email],
    );

    expect(related).toEqual({ profiles: 1, privacy: 1, legal: 2 });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123' });

    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(email);
  });
});
