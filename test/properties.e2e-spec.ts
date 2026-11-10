import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Properties API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let landlordId: string | undefined;
  let seekerId: string | undefined;
  let cityId: string | undefined;
  let zoneId: string | undefined;
  let amenityId: string | undefined;
  let propertyId: string | undefined;
  let conversationId: string | undefined;
  let createdPropertyId: string | undefined;

  const suffix = randomUUID();
  const amenityCode = `wifi-e2e-${suffix}`;

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

    const [landlord]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO users (
        email, status, active_mode, identity_status, identity_verified_at,
        landlord_enabled_at
      ) VALUES ($1, 'active', 'landlord', 'verified', now(), now())
      RETURNING id`,
      [`properties-e2e-landlord-${suffix}@example.com`],
    );
    landlordId = landlord.id;

    const [seeker]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO users (email, status)
       VALUES ($1, 'active') RETURNING id`,
      [`properties-e2e-seeker-${suffix}@example.com`],
    );
    seekerId = seeker.id;

    const [city]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO cities (name, state_name)
       VALUES ('Properties E2E City', 'CDMX') RETURNING id`,
    );
    cityId = city.id;

    const [zone]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO zones (city_id, name, slug)
       VALUES ($1, 'Properties E2E Zone', $2) RETURNING id`,
      [cityId, `properties-e2e-zone-${suffix}`],
    );
    zoneId = zone.id;

    const [amenity]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO amenities (code, name)
       VALUES ($1, 'WiFi E2E') RETURNING id`,
      [amenityCode],
    );
    amenityId = amenity.id;

    const [property]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO properties (
        landlord_id, title, description, property_type, city_id, zone_id,
        address_exact, location_exact, location_public, rent_amount,
        deposit_amount, additional_costs_estimate, available_from, bedrooms,
        bathrooms, furnished, pets_allowed, smokers_allowed, house_rules,
        requires_guarantor, requires_income_proof, min_contract_months,
        status, published_at
      ) VALUES (
        $1, 'Properties E2E Active', 'Anuncio de prueba', 'room', $2, $3,
        'Calle Privada 123', '(-99.133209,19.432608)'::point,
        '(-99.14,19.44)'::point, 5000, 5000, 500, '2026-12-01', 2, 1,
        true, true, false, 'No fiestas', true, false, 6, 'active', now()
      ) RETURNING id`,
      [landlordId, cityId, zoneId],
    );
    propertyId = property.id;

    await dataSource.query(
      `INSERT INTO property_amenities (property_id, amenity_id)
       VALUES ($1, $2)`,
      [propertyId, amenityId],
    );

    await dataSource.query(
      `INSERT INTO properties (
        landlord_id, title, property_type, city_id, zone_id, address_exact,
        location_exact, location_public, rent_amount, available_from, bedrooms,
        bathrooms, status, published_at
      ) VALUES (
        $1, 'Properties E2E Second', 'apartment', $2, $3,
        'Calle Privada 456', '(-99.15,19.45)'::point,
        '(-99.16,19.46)'::point, 4000, '2026-12-15', 1, 1, 'active', now()
      )`,
      [landlordId, cityId, zoneId],
    );

    const [conversation]: Array<{ id: string }> = await dataSource.query(
      `INSERT INTO conversations (
        kind, property_id, initiator_user_id, status
      ) VALUES ('rental', $1, $2, 'active') RETURNING id`,
      [propertyId, seekerId],
    );
    conversationId = conversation.id;

    await dataSource.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [conversationId, seekerId, landlordId],
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (landlordId) {
        await dataSource.query(
          `DELETE FROM properties WHERE landlord_id = $1`,
          [landlordId],
        );
        await dataSource.query(`DELETE FROM users WHERE id = $1`, [landlordId]);
      }
      if (seekerId) {
        await dataSource.query(`DELETE FROM users WHERE id = $1`, [seekerId]);
      }
      if (zoneId) {
        await dataSource.query(`DELETE FROM zones WHERE id = $1`, [zoneId]);
      }
      if (cityId) {
        await dataSource.query(`DELETE FROM cities WHERE id = $1`, [cityId]);
      }
      if (amenityId) {
        await dataSource.query(`DELETE FROM amenities WHERE id = $1`, [
          amenityId,
        ]);
      }
    }

    await app?.close();
  });

  it('searches active listings with filters and hides private location fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/properties')
      .query({
        cityId,
        amenityIds: amenityId,
        sort: 'price_asc',
        limit: 10,
      })
      .expect(200);

    const item = response.body.data.find(
      (property: { id: string }) => property.id === propertyId,
    );

    expect(item).toBeDefined();
    expect(item.locationPublic).toEqual({
      latitude: 19.44,
      longitude: -99.14,
    });
    expect(item).not.toHaveProperty('addressExact');
    expect(item).not.toHaveProperty('locationExact');
    expect(item.amenities).toEqual([
      { id: amenityId, code: amenityCode, name: 'WiFi E2E' },
    ]);
  });

  it('paginates search results with an opaque cursor', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/api/v1/properties')
      .query({ cityId, sort: 'price_asc', limit: 1 })
      .expect(200);

    expect(firstPage.body.data).toHaveLength(1);
    expect(Number(firstPage.body.data[0].rentAmount)).toBe(4000);
    expect(firstPage.body.nextCursor).toBeTruthy();

    const secondPage = await request(app.getHttpServer())
      .get('/api/v1/properties')
      .query({
        cityId,
        sort: 'price_asc',
        limit: 1,
        cursor: firstPage.body.nextCursor,
      })
      .expect(200);

    expect(secondPage.body.data).toHaveLength(1);
    expect(Number(secondPage.body.data[0].rentAmount)).toBe(5000);
    expect(secondPage.body.data[0].id).toBe(propertyId);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('returns map markers with public locations only', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/properties/map')
      .query({ cityId })
      .expect(200);

    const item = response.body.data.find(
      (property: { id: string }) => property.id === propertyId,
    );

    expect(item).toBeDefined();
    expect(item.locationPublic).toEqual({
      latitude: 19.44,
      longitude: -99.14,
    });
    expect(item).not.toHaveProperty('addressExact');
    expect(item).not.toHaveProperty('locationExact');
  });

  it('hides exact location from anonymous visitors', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .expect(200);

    expect(response.body.addressExact).toBeUndefined();
    expect(response.body.locationExact).toBeUndefined();
  });

  it('shows exact location to the landlord and to a valid rental contact', async () => {
    const ownerResponse = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set('x-user-id', landlordId!)
      .expect(200);

    expect(ownerResponse.body.addressExact).toBe('Calle Privada 123');
    expect(ownerResponse.body.locationExact).toEqual({
      latitude: 19.432608,
      longitude: -99.133209,
    });

    const contactResponse = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set('x-user-id', seekerId!)
      .expect(200);

    expect(contactResponse.body.addressExact).toBe('Calle Privada 123');
  });

  it('creates, edits and submits a draft through the landlord flow', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('x-user-id', landlordId!)
      .send({
        title: 'Draft E2E',
        propertyType: 'apartment',
        cityId,
        zoneId,
        rentAmount: 4500,
        availableFrom: '2027-01-01',
        locationExact: { latitude: 19.43, longitude: -99.13 },
      })
      .expect(201);

    createdPropertyId = createResponse.body.id;
    expect(createResponse.body.status).toBe('draft');
    expect(createResponse.body.locationPublic).toBeTruthy();

    const mineResponse = await request(app.getHttpServer())
      .get('/api/v1/properties/me')
      .set('x-user-id', landlordId!)
      .expect(200);

    expect(
      mineResponse.body.data.some(
        (property: { id: string }) => property.id === createdPropertyId,
      ),
    ).toBe(true);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}`)
      .set('x-user-id', landlordId!)
      .send({ title: 'Draft E2E Updated' })
      .expect(200);

    expect(updateResponse.body.title).toBe('Draft E2E Updated');

    const amenitiesResponse = await request(app.getHttpServer())
      .put(`/api/v1/properties/${createdPropertyId}/amenities`)
      .set('x-user-id', landlordId!)
      .send({ amenityIds: [amenityId] })
      .expect(200);

    expect(amenitiesResponse.body.data).toHaveLength(1);

    const reviewResponse = await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/submit-review`)
      .set('x-user-id', landlordId!)
      .expect(200);

    expect(reviewResponse.body.status).toBe('in_review');
  });

  it('validates availability transitions and records them in a transaction', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}/status`)
      .set('x-user-id', landlordId!)
      .send({ status: 'reserved' })
      .expect(400);

    await dataSource.query(
      `UPDATE properties SET status = 'active', published_at = now()
       WHERE id = $1`,
      [createdPropertyId],
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}/status`)
      .set('x-user-id', landlordId!)
      .send({ status: 'reserved' })
      .expect(200);

    const activeResponse = await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}/status`)
      .set('x-user-id', landlordId!)
      .send({ status: 'active' })
      .expect(200);

    expect(activeResponse.body.status).toBe('active');

    const history: Array<{ to_status: string }> = await dataSource.query(
      `SELECT to_status FROM property_status_history
       WHERE property_id = $1 ORDER BY created_at ASC, id ASC`,
      [createdPropertyId],
    );

    expect(history.map((row) => row.to_status)).toEqual([
      'draft',
      'in_review',
      'reserved',
      'active',
    ]);
  });

  it('manages favorites idempotently', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/favorite`)
      .set('x-user-id', seekerId!)
      .expect(204);

    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/favorite`)
      .set('x-user-id', seekerId!)
      .expect(204);

    const favoritesResponse = await request(app.getHttpServer())
      .get('/api/v1/properties/me/favorites')
      .set('x-user-id', seekerId!)
      .expect(200);

    const favorite = favoritesResponse.body.data.find(
      (property: { id: string }) => property.id === propertyId,
    );

    expect(favorite).toBeDefined();
    expect(favorite.isAvailable).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/properties/${propertyId}/favorite`)
      .set('x-user-id', seekerId!)
      .expect(204);
  });

  it('lists the rental contacts derived from conversations', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/contacts`)
      .set('x-user-id', landlordId!)
      .expect(200);

    expect(response.body.data[0]).toMatchObject({
      conversationId,
      userId: seekerId,
      conversationStatus: 'active',
    });
  });

  it('soft-deletes listings and keeps the history', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/properties/${propertyId}`)
      .set('x-user-id', landlordId!)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .expect(404);

    const rows: Array<{ status: string; deleted_at: Date | null }> =
      await dataSource.query(
        `SELECT status, deleted_at FROM properties WHERE id = $1`,
        [propertyId],
      );

    expect(rows[0].status).toBe('deleted');
    expect(rows[0].deleted_at).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/properties/${createdPropertyId}`)
      .set('x-user-id', landlordId!)
      .expect(204);
  });
});
