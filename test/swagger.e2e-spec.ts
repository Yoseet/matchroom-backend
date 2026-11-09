import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupSwagger } from '../src/config/swagger.js';

describe('OpenAPI (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the OpenAPI JSON document', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.info.title).toBe('MatchRoom API');
    expect(response.body.paths).toHaveProperty('/api/v1/health');
    expect(response.body.paths['/api/v1/health'].get.tags).toContain('health');
    expect(
      response.body.components.securitySchemes['access-token'],
    ).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('documents the health response schema', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const healthResponse =
      response.body.paths['/api/v1/health'].get.responses['200'].content[
        'application/json'
      ].schema;

    expect(healthResponse.$ref).toBe('#/components/schemas/HealthResponseDto');
    expect(response.body.components.schemas.HealthResponseDto.required).toEqual(
      expect.arrayContaining(['status', 'database', 'latencyMs', 'timestamp']),
    );
  });

  it('documents the catalog endpoints and paginated responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.paths).toHaveProperty('/api/v1/catalog/cities');
    expect(response.body.paths).toHaveProperty('/api/v1/catalog/zones');
    expect(response.body.paths).toHaveProperty('/api/v1/catalog/amenities');
    expect(response.body.paths).toHaveProperty('/api/v1/catalog/autocomplete');

    for (const path of [
      '/api/v1/catalog/cities',
      '/api/v1/catalog/zones',
      '/api/v1/catalog/amenities',
      '/api/v1/catalog/autocomplete',
    ]) {
      expect(response.body.paths[path].get.tags).toContain('catalog');
      expect(response.body.paths[path].get.responses['200']).toBeDefined();
    }

    const citiesResponse =
      response.body.paths['/api/v1/catalog/cities'].get.responses['200']
        .content['application/json'].schema;
    const zonesResponse =
      response.body.paths['/api/v1/catalog/zones'].get.responses['200'].content[
        'application/json'
      ].schema;
    const amenitiesResponse =
      response.body.paths['/api/v1/catalog/amenities'].get.responses['200']
        .content['application/json'].schema;
    const autocompleteResponse =
      response.body.paths['/api/v1/catalog/autocomplete'].get.responses['200']
        .content['application/json'].schema;

    expect(citiesResponse.$ref).toBe(
      '#/components/schemas/PaginatedCitiesResponseDto',
    );
    expect(zonesResponse.$ref).toBe(
      '#/components/schemas/PaginatedZonesResponseDto',
    );
    expect(amenitiesResponse.$ref).toBe(
      '#/components/schemas/PaginatedAmenitiesResponseDto',
    );
    expect(autocompleteResponse.$ref).toBe(
      '#/components/schemas/PaginatedAutocompleteResponseDto',
    );

    const cityParameters =
      response.body.paths['/api/v1/catalog/cities'].get.parameters;
    expect(
      cityParameters.map((parameter: { name: string }) => parameter.name),
    ).toEqual(
      expect.arrayContaining(['page', 'pageSize', 'postalCode', 'stateName']),
    );
  });

  it('serves the Swagger UI', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);

    expect(response.text).toContain('Swagger UI');
  });
});
