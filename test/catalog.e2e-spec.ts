import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseExceptionFilter } from '../src/common/filters/database-exception.filter.js';
import { Amenity } from '../src/modules/catalog/domain/entities/amenity.entity.js';
import { City } from '../src/modules/catalog/domain/entities/city.entity.js';
import { Zone } from '../src/modules/catalog/domain/entities/zone.entity.js';

const SUFFIX = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ACTIVE_CITY_NAME = `Ciudad Prueba ${SUFFIX}`;
const INACTIVE_CITY_NAME = `Ciudad Inactiva ${SUFFIX}`;
const STATE_NAME = `Estado Prueba ${SUFFIX}`;
const ACTIVE_ZONE_NAME = `Zona Autocomplete ${SUFFIX}`;
const SECOND_ZONE_NAME = `Zona Alterna ${SUFFIX}`;
const INACTIVE_ZONE_NAME = `Zona Inactiva ${SUFFIX}`;
const POSTAL_CODE = '00001';
const SECOND_POSTAL_CODE = '00002';

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let activeCityId: string;
  let inactiveCityId: string;
  let activeZoneId: string;
  let secondZoneId: string;
  let inactiveZoneId: string;
  let activeAmenityId: string;
  let inactiveAmenityId: string;

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
    app.useGlobalFilters(new DatabaseExceptionFilter());
    await app.init();

    dataSource = app.get(DataSource);

    const cities = dataSource.getRepository(City);
    const zones = dataSource.getRepository(Zone);
    const amenities = dataSource.getRepository(Amenity);

    const activeCity = await cities.save(
      cities.create({
        name: ACTIVE_CITY_NAME,
        stateName: STATE_NAME,
        countryCode: 'MX',
        isActive: true,
      }),
    );
    const inactiveCity = await cities.save(
      cities.create({
        name: INACTIVE_CITY_NAME,
        stateName: STATE_NAME,
        countryCode: 'MX',
        isActive: false,
      }),
    );

    activeCityId = activeCity.id;
    inactiveCityId = inactiveCity.id;

    const activeZone = await zones.save(
      zones.create({
        cityId: activeCityId,
        name: ACTIVE_ZONE_NAME,
        slug: `zona-autocomplete-${SUFFIX}`,
        postalCode: POSTAL_CODE,
        isActive: true,
      }),
    );
    const secondZone = await zones.save(
      zones.create({
        cityId: activeCityId,
        name: SECOND_ZONE_NAME,
        slug: `zona-alterna-${SUFFIX}`,
        postalCode: SECOND_POSTAL_CODE,
        isActive: true,
      }),
    );
    const inactiveZone = await zones.save(
      zones.create({
        cityId: inactiveCityId,
        name: INACTIVE_ZONE_NAME,
        slug: `zona-inactiva-${SUFFIX}`,
        postalCode: POSTAL_CODE,
        isActive: true,
      }),
    );

    activeZoneId = activeZone.id;
    secondZoneId = secondZone.id;
    inactiveZoneId = inactiveZone.id;

    const activeAmenity = await amenities.save(
      amenities.create({
        code: `amenidad_prueba_${SUFFIX}`,
        name: `AAA Amenidad Prueba ${SUFFIX}`,
        isActive: true,
      }),
    );
    const inactiveAmenity = await amenities.save(
      amenities.create({
        code: `amenidad_inactiva_${SUFFIX}`,
        name: `AAB Amenidad Inactiva ${SUFFIX}`,
        isActive: false,
      }),
    );

    activeAmenityId = activeAmenity.id;
    inactiveAmenityId = inactiveAmenity.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(Amenity).delete({
        id: In([activeAmenityId, inactiveAmenityId]),
      });
      await dataSource.getRepository(Zone).delete({
        cityId: In([activeCityId, inactiveCityId]),
      });
      await dataSource.getRepository(City).delete({
        id: In([activeCityId, inactiveCityId]),
      });
    }

    await app?.close();
  });

  it('lists active cities filtered by postal code with pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/cities')
      .query({ postalCode: POSTAL_CODE, page: 1, pageSize: 10 })
      .expect(200);

    expect(response.body.meta).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(response.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(response.body.data)).toBe(true);

    const ids = response.body.data.map((city: { id: string }) => city.id);
    expect(ids).toContain(activeCityId);
    expect(ids).not.toContain(inactiveCityId);
  });

  it('filters active cities by state name', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/cities')
      .query({ stateName: STATE_NAME, page: 1, pageSize: 10 })
      .expect(200);

    const ids = response.body.data.map((city: { id: string }) => city.id);
    expect(ids).toContain(activeCityId);
    expect(ids).not.toContain(inactiveCityId);
    expect(
      response.body.data.every(
        (city: { stateName: string }) => city.stateName === STATE_NAME,
      ),
    ).toBe(true);
  });

  it('lists active amenities with pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/amenities')
      .query({ page: 1, pageSize: 100 })
      .expect(200);

    expect(response.body.meta).toMatchObject({
      page: 1,
      pageSize: 100,
    });
    expect(response.body.meta.total).toBeGreaterThanOrEqual(1);

    const ids = response.body.data.map((amenity: { id: string }) => amenity.id);
    expect(ids).toContain(activeAmenityId);
    expect(ids).not.toContain(inactiveAmenityId);
    expect(response.body.data[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      isActive: true,
    });
  });

  it('lists zones by city', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/zones')
      .query({ cityId: activeCityId, page: 1, pageSize: 10 })
      .expect(200);

    const ids = response.body.data.map((zone: { id: string }) => zone.id);
    expect(ids).toEqual(expect.arrayContaining([activeZoneId, secondZoneId]));
    expect(ids).not.toContain(inactiveZoneId);
    expect(response.body.meta.total).toBe(2);
  });

  it('lists zones without requiring a city', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/zones')
      .query({ page: 1, pageSize: 5 })
      .expect(200);

    expect(response.body.data).toHaveLength(5);
    expect(response.body.meta.pageSize).toBe(5);
    expect(response.body.meta.total).toBeGreaterThanOrEqual(5);
  });

  it('filters zones and cities by postal code', async () => {
    const zonesResponse = await request(app.getHttpServer())
      .get('/api/v1/catalog/zones')
      .query({ postalCode: POSTAL_CODE, page: 1, pageSize: 10 })
      .expect(200);

    const zoneIds = zonesResponse.body.data.map(
      (zone: { id: string }) => zone.id,
    );
    expect(zoneIds).toContain(activeZoneId);
    expect(zoneIds).not.toContain(secondZoneId);
    expect(zoneIds).not.toContain(inactiveZoneId);

    const citiesResponse = await request(app.getHttpServer())
      .get('/api/v1/catalog/cities')
      .query({ postalCode: POSTAL_CODE, page: 1, pageSize: 10 })
      .expect(200);

    const cityIds = citiesResponse.body.data.map(
      (city: { id: string }) => city.id,
    );
    expect(cityIds).toContain(activeCityId);
    expect(cityIds).not.toContain(inactiveCityId);
  });

  it('autocompletes zones and cities', async () => {
    const zonesResponse = await request(app.getHttpServer())
      .get('/api/v1/catalog/autocomplete')
      .query({ q: ACTIVE_ZONE_NAME, type: 'zones', page: 1, pageSize: 10 })
      .expect(200);

    expect(zonesResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'zone',
          id: activeZoneId,
          name: ACTIVE_ZONE_NAME,
          cityId: activeCityId,
          postalCode: POSTAL_CODE,
        }),
      ]),
    );

    const citiesResponse = await request(app.getHttpServer())
      .get('/api/v1/catalog/autocomplete')
      .query({ q: ACTIVE_CITY_NAME, type: 'cities', page: 1, pageSize: 10 })
      .expect(200);

    expect(citiesResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'city',
          id: activeCityId,
          name: ACTIVE_CITY_NAME,
          stateName: STATE_NAME,
        }),
      ]),
    );
  });

  it('rejects invalid postal codes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/cities')
      .query({ postalCode: '123' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/catalog/zones')
      .query({ postalCode: 'abcde' })
      .expect(400);
  });
});
