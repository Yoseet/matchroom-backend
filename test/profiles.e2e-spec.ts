import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseExceptionFilter } from '../src/common/filters/database-exception.filter.js';
import { User } from '../src/modules/accounts/domain/entities/user.entity.js';
import {
  Amenity,
  City,
  Zone,
} from '../src/modules/catalog/domain/entities/index.js';
import { MediaAsset } from '../src/modules/media/domain/entities/media-asset.entity.js';
import { PrivacySetting } from '../src/modules/privacy/domain/entities/privacy-setting.entity.js';
import { Profile } from '../src/modules/profiles/domain/entities/index.js';
import { UserBlock } from '../src/modules/safety/domain/entities/user-block.entity.js';

describe('Profiles (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = {
    owner: `profiles-owner-${suffix}@example.com`,
    viewer: `profiles-viewer-${suffix}@example.com`,
    creator: `profiles-creator-${suffix}@example.com`,
  };

  let owner: User;
  let viewer: User;
  let creator: User;
  let city: City;
  let otherCity: City;
  let zone: Zone;
  let secondZone: Zone;
  let otherCityZone: Zone;
  let amenity: Amenity;
  let secondAmenity: Amenity;
  let ownerPhoto: MediaAsset;
  let viewerPhoto: MediaAsset;

  const ownerHeaders = () => ({ 'x-user-id': owner.id });
  const viewerHeaders = () => ({ 'x-user-id': viewer.id });

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

    city = await dataSource.getRepository(City).save(
      dataSource.getRepository(City).create({
        name: `Test City ${suffix}`,
        stateName: 'Test State',
      }),
    );

    otherCity = await dataSource.getRepository(City).save(
      dataSource.getRepository(City).create({
        name: `Other City ${suffix}`,
        stateName: 'Test State',
      }),
    );

    zone = await dataSource.getRepository(Zone).save(
      dataSource.getRepository(Zone).create({
        cityId: city.id,
        name: `Test Zone ${suffix}`,
        slug: `test-zone-${suffix}`,
      }),
    );

    secondZone = await dataSource.getRepository(Zone).save(
      dataSource.getRepository(Zone).create({
        cityId: city.id,
        name: `Second Zone ${suffix}`,
        slug: `second-zone-${suffix}`,
      }),
    );

    otherCityZone = await dataSource.getRepository(Zone).save(
      dataSource.getRepository(Zone).create({
        cityId: otherCity.id,
        name: `Other Zone ${suffix}`,
        slug: `other-zone-${suffix}`,
      }),
    );

    amenity = await dataSource.getRepository(Amenity).save(
      dataSource.getRepository(Amenity).create({
        code: `internet-${suffix}`,
        name: `Internet ${suffix}`,
      }),
    );

    secondAmenity = await dataSource.getRepository(Amenity).save(
      dataSource.getRepository(Amenity).create({
        code: `parking-${suffix}`,
        name: `Parking ${suffix}`,
      }),
    );

    owner = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({ email: emails.owner }),
    );

    viewer = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({ email: emails.viewer }),
    );

    creator = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({ email: emails.creator }),
    );

    await dataSource.getRepository(Profile).save(
      dataSource.getRepository(Profile).create({
        userId: owner.id,
        lookingFor: 'both',
      }),
    );

    const viewerProfile = dataSource.getRepository(Profile).create({
      userId: viewer.id,
      firstName: 'Viewer',
      lastName: 'Profile',
      lookingFor: 'housing',
      cityId: city.id,
    });
    viewerProfile.completenessPct = 80;
    await dataSource.getRepository(Profile).save(viewerProfile);

    ownerPhoto = await dataSource.getRepository(MediaAsset).save(
      dataSource.getRepository(MediaAsset).create({
        ownerUserId: owner.id,
        kind: 'profile_photo',
        storageKey: `profiles/owner-${suffix}`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        moderationStatus: 'approved',
      }),
    );

    viewerPhoto = await dataSource.getRepository(MediaAsset).save(
      dataSource.getRepository(MediaAsset).create({
        ownerUserId: viewer.id,
        kind: 'profile_photo',
        storageKey: `profiles/viewer-${suffix}`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        moderationStatus: 'approved',
      }),
    );

    await dataSource.getRepository(PrivacySetting).save(
      dataSource.getRepository(PrivacySetting).create({
        userId: viewer.id,
      }),
    );
  });

  afterAll(async () => {
    if (dataSource && owner && viewer && creator) {
      await dataSource.getRepository(UserBlock).delete({
        blockerId: In([owner.id, viewer.id]),
      });
      await dataSource.getRepository(UserBlock).delete({
        blockedId: In([owner.id, viewer.id]),
      });
      await dataSource.getRepository(MediaAsset).delete({
        ownerUserId: In([owner.id, viewer.id]),
      });
      await dataSource.getRepository(User).delete({
        id: In([owner.id, viewer.id, creator.id]),
      });
      await dataSource.getRepository(Zone).delete({
        cityId: In([city.id, otherCity.id]),
      });
      await dataSource.getRepository(City).delete({
        id: In([city.id, otherCity.id]),
      });
      await dataSource
        .getRepository(Amenity)
        .delete({ id: In([amenity.id, secondAmenity.id]) });
    }

    await app.close();
  });

  it('returns the empty own profile and 0 completeness', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles/me')
      .set(ownerHeaders())
      .expect(200);

    expect(response.body).toMatchObject({
      userId: owner.id,
      lookingFor: 'both',
      completenessPct: 0,
      preferredZones: [],
      preferredAmenities: [],
    });
    expect(response.body.lifestyle).toBeNull();
  });

  it('rejects requests without the acting user header', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/profiles/me')
      .expect(401);
  });

  it('creates the profile with POST', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/profiles/me')
      .set({ 'x-user-id': creator.id })
      .send({ firstName: 'Nuevo' })
      .expect(201);

    expect(response.body).toMatchObject({
      userId: creator.id,
      firstName: 'Nuevo',
      lookingFor: 'both',
      completenessPct: 5,
    });
  });

  it('returns 409 when POSTing an existing profile', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/profiles/me')
      .set({ 'x-user-id': creator.id })
      .send({ firstName: 'Duplicado' })
      .expect(409);
  });

  it('creates lifestyle, roommate and housing rows with POST', async () => {
    const lifestyle = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/lifestyle')
      .set({ 'x-user-id': creator.id })
      .send({ cleanlinessLevel: 3, smokes: false })
      .expect(201);

    expect(lifestyle.body).toMatchObject({
      cleanlinessLevel: 3,
      smokes: false,
      hasPets: null,
    });

    const roommate = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/roommate-preferences')
      .set({ 'x-user-id': creator.id })
      .send({ smokingPolicy: 'reject', minAge: 21, maxAge: 35 })
      .expect(201);

    expect(roommate.body).toMatchObject({
      smokingPolicy: 'reject',
      minAge: 21,
      maxAge: 35,
    });

    const housing = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/housing-preferences')
      .set({ 'x-user-id': creator.id })
      .send({ propertyType: 'room', budgetMin: 3000, budgetMax: 6000 })
      .expect(201);

    expect(housing.body).toMatchObject({
      propertyType: 'room',
      budgetMin: '3000.00',
      budgetMax: '6000.00',
    });
  });

  it('returns 409 when POSTing an existing lifestyle row', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/profiles/me/lifestyle')
      .set({ 'x-user-id': creator.id })
      .send({ cleanlinessLevel: 4 })
      .expect(409);
  });

  it('rejects underage birth dates', async () => {
    const almostAdult = new Date();
    almostAdult.setUTCFullYear(almostAdult.getUTCFullYear() - 17);
    const birthDate = almostAdult.toISOString().slice(0, 10);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/profiles/me')
      .set(ownerHeaders())
      .send({ birthDate })
      .expect(400);

    expect(response.body.message).toContain('at least 18');
  });

  it('rejects a photo owned by another user', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/profiles/me')
      .set(ownerHeaders())
      .send({ photoAssetId: viewerPhoto.id })
      .expect(400);

    expect(response.body.message).toContain('belong to the current user');
  });

  it('rejects a null looking_for value', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/profiles/me')
      .set(ownerHeaders())
      .send({ lookingFor: null })
      .expect(400);
  });

  it('updates personal data and looking_for', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/profiles/me')
      .set(ownerHeaders())
      .send({
        firstName: 'Ana',
        lastName: 'Pérez',
        birthDate: '1997-03-14',
        gender: 'female',
        bio: 'Busco un roomie tranquilo.',
        occupation: 'Diseñadora',
        contactPhone: '+525512345678',
        photoAssetId: ownerPhoto.id,
        cityId: city.id,
        lookingFor: 'both',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      firstName: 'Ana',
      lastName: 'Pérez',
      cityId: city.id,
      city: { id: city.id },
      lookingFor: 'both',
      photoAssetId: ownerPhoto.id,
      completenessPct: 40,
    });
    expect(response.body.age).toBeGreaterThanOrEqual(18);
  });

  it('replaces lifestyle habits', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/profiles/me/lifestyle')
      .set(ownerHeaders())
      .send({
        cleanlinessLevel: 4,
        smokes: false,
        hasPets: true,
        noiseLevel: 2,
        visitsFrequency: 'sometimes',
        sleepSchedule: 'regular',
        workSchedule: 'remote',
        cohabitationType: 'any',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      cleanlinessLevel: 4,
      smokes: false,
      hasPets: true,
      noiseLevel: 2,
      visitsFrequency: 'sometimes',
      sleepSchedule: 'regular',
      workSchedule: 'remote',
      cohabitationType: 'any',
    });
  });

  it('validates roommate age ranges', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/profiles/me/roommate-preferences')
      .set(ownerHeaders())
      .send({ minAge: 35, maxAge: 25 })
      .expect(400);
  });

  it('replaces roommate preferences and exclusive criteria', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/profiles/me/roommate-preferences')
      .set(ownerHeaders())
      .send({
        smokingPolicy: 'reject',
        petsPolicy: 'accept',
        maxNoiseLevel: 3,
        maxVisitsFrequency: 'sometimes',
        minCleanlinessLevel: 3,
        minAge: 24,
        maxAge: 38,
        exclusiveCriteria: ['smoking', 'pets'],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      smokingPolicy: 'reject',
      petsPolicy: 'accept',
      maxNoiseLevel: 3,
      minAge: 24,
      maxAge: 38,
      exclusiveCriteria: ['smoking', 'pets'],
    });
  });

  it('validates housing budget ranges', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/profiles/me/housing-preferences')
      .set(ownerHeaders())
      .send({ budgetMin: 9000, budgetMax: 5000 })
      .expect(400);
  });

  it('replaces housing preferences', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/profiles/me/housing-preferences')
      .set(ownerHeaders())
      .send({
        propertyType: 'apartment',
        budgetMin: 5000,
        budgetMax: 9000,
        moveInDate: '2026-12-01',
        requiresFurnished: true,
        requiresPetsAllowed: true,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      propertyType: 'apartment',
      budgetMin: '5000.00',
      budgetMax: '9000.00',
      moveInDate: '2026-12-01',
      requiresFurnished: true,
      requiresPetsAllowed: true,
    });
  });

  it('rejects zones from another city', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/profiles/me/preferred-zones')
      .set(ownerHeaders())
      .send({ zoneIds: [otherCityZone.id] })
      .expect(400);

    expect(response.body.message).toContain('profile city');
  });

  it('replaces preferred zones', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/profiles/me/preferred-zones')
      .set(ownerHeaders())
      .send({ zoneIds: [zone.id] })
      .expect(200);

    expect(response.body.preferredZones).toEqual([
      { id: zone.id, name: zone.name },
    ]);
  });

  it('appends preferred zones with POST without duplicating', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/preferred-zones')
      .set(ownerHeaders())
      .send({ zoneIds: [secondZone.id] })
      .expect(201);

    expect(
      first.body.preferredZones.map((item: { id: string }) => item.id).sort(),
    ).toEqual([zone.id, secondZone.id].sort());

    const repeated = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/preferred-zones')
      .set(ownerHeaders())
      .send({ zoneIds: [zone.id] })
      .expect(201);

    expect(repeated.body.preferredZones).toHaveLength(2);
  });

  it('rejects amenity ids that do not exist', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/profiles/me/preferred-amenities')
      .set(ownerHeaders())
      .send({ amenityIds: ['018f3b1a-8f24-4b35-a1c2-3d4e5f607189'] })
      .expect(400);
  });

  it('replaces preferred amenities', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/profiles/me/preferred-amenities')
      .set(ownerHeaders())
      .send({ amenityIds: [amenity.id] })
      .expect(200);

    expect(response.body.preferredAmenities).toEqual([
      { id: amenity.id, code: amenity.code, name: amenity.name },
    ]);
  });

  it('appends preferred amenities with POST without duplicating', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/preferred-amenities')
      .set(ownerHeaders())
      .send({ amenityIds: [secondAmenity.id] })
      .expect(201);

    expect(
      first.body.preferredAmenities
        .map((item: { id: string }) => item.id)
        .sort(),
    ).toEqual([amenity.id, secondAmenity.id].sort());

    const repeated = await request(app.getHttpServer())
      .post('/api/v1/profiles/me/preferred-amenities')
      .set(ownerHeaders())
      .send({ amenityIds: [amenity.id] })
      .expect(201);

    expect(repeated.body.preferredAmenities).toHaveLength(2);
  });

  it('reports 100 percent completeness after filling every section', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles/me/completeness')
      .set(ownerHeaders())
      .expect(200);

    expect(response.body.completenessPct).toBe(100);
    expect(response.body.missingFields).toEqual([]);
  });

  it('returns a privacy-projected public profile without contact phone', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${owner.id}`)
      .set(viewerHeaders())
      .expect(200);

    expect(response.body).toMatchObject({
      userId: owner.id,
      firstName: 'Ana',
      lookingFor: 'both',
    });
    expect(response.body.contactPhone).toBeUndefined();
    expect(response.body.birthDate).toBeUndefined();
    expect(response.body.lifestyle).not.toBeNull();
    expect(response.body.roommatePreferences).not.toBeNull();
    expect(response.body.housingPreferences).not.toBeNull();
  });

  it('hides non-approved photos from the public projection', async () => {
    await dataSource
      .getRepository(MediaAsset)
      .update({ id: ownerPhoto.id }, { moderationStatus: 'pending' });

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${owner.id}`)
      .set(viewerHeaders())
      .expect(200);

    expect(hidden.body.photoAssetId).toBeNull();

    await dataSource
      .getRepository(MediaAsset)
      .update({ id: ownerPhoto.id }, { moderationStatus: 'approved' });
  });

  it('applies privacy settings to public fields', async () => {
    await dataSource.getRepository(PrivacySetting).save(
      dataSource.getRepository(PrivacySetting).create({
        userId: owner.id,
        showExactAge: false,
        showOccupation: false,
        showPhoto: false,
      }),
    );

    const response = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${owner.id}`)
      .set(viewerHeaders())
      .expect(200);

    expect(response.body.age).toBeNull();
    expect(response.body.occupation).toBeNull();
    expect(response.body.photoAssetId).toBeNull();
  });

  it('only exposes sections relevant to the profile looking_for', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${viewer.id}`)
      .set(ownerHeaders())
      .expect(200);

    expect(response.body.lookingFor).toBe('housing');
    expect(response.body.lifestyle).toBeNull();
    expect(response.body.roommatePreferences).toBeNull();
  });

  it('filters discoverable profiles by looking_for', async () => {
    const roommateResponse = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ lookingFor: 'roommate', cityId: city.id })
      .set(ownerHeaders())
      .expect(200);

    expect(
      roommateResponse.body.data.some(
        (profile: { userId: string }) => profile.userId === viewer.id,
      ),
    ).toBe(false);

    const housingResponse = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ lookingFor: 'housing', cityId: city.id })
      .set(ownerHeaders())
      .expect(200);

    expect(
      housingResponse.body.data.some(
        (profile: { userId: string }) => profile.userId === viewer.id,
      ),
    ).toBe(true);
    expect(housingResponse.body.nextCursor).toBeNull();
  });

  it('hides profiles with appear_in_search disabled and blocks', async () => {
    const privacy = await dataSource
      .getRepository(PrivacySetting)
      .findOneByOrFail({ userId: viewer.id });

    privacy.appearInSearch = false;
    await dataSource.getRepository(PrivacySetting).save(privacy);

    await request(app.getHttpServer())
      .get(`/api/v1/profiles/${viewer.id}`)
      .set(ownerHeaders())
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ cityId: city.id })
      .set(ownerHeaders())
      .expect(200);

    expect(
      listResponse.body.data.some(
        (profile: { userId: string }) => profile.userId === viewer.id,
      ),
    ).toBe(false);

    privacy.appearInSearch = true;
    await dataSource.getRepository(PrivacySetting).save(privacy);

    await dataSource.getRepository(UserBlock).save(
      dataSource.getRepository(UserBlock).create({
        blockerId: owner.id,
        blockedId: viewer.id,
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/profiles/${viewer.id}`)
      .set(ownerHeaders())
      .expect(404);
  });

  it('rejects malformed profile ids', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/profiles/not-a-uuid')
      .set(ownerHeaders())
      .expect(400);
  });
});
