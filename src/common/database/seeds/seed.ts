import 'reflect-metadata';
import type { DeepPartial } from 'typeorm';
import { User } from '../../../modules/accounts/domain/entities/index.js';
import {
  Amenity,
  City,
  Zone,
} from '../../../modules/catalog/domain/entities/index.js';
import { MediaAsset } from '../../../modules/media/domain/entities/index.js';
import { PrivacySetting } from '../../../modules/privacy/domain/entities/index.js';
import {
  HousingPreference,
  HousingPreferenceAmenity,
  LifestyleProfile,
  Profile,
  RoommatePreference,
  UserPreferredZone,
} from '../../../modules/profiles/domain/entities/index.js';
import { ProfileCompletenessService } from '../../../modules/profiles/application/services/profile-completeness.service.js';
import { AppDataSource } from '../data-source.js';

interface SeedUserDefinition {
  email: string;
  photoStorageKey: string;
  profile: DeepPartial<Profile>;
  lifestyle: DeepPartial<LifestyleProfile>;
  roommate: DeepPartial<RoommatePreference>;
  housing: DeepPartial<HousingPreference>;
  zoneSlugs: string[];
  amenityCodes: string[];
}

const CITY = {
  name: 'Ciudad de México',
  stateName: 'Ciudad de México',
  countryCode: 'MX',
};

const ZONES = [
  { name: 'Roma Norte', slug: 'roma-norte' },
  { name: 'Condesa', slug: 'condesa' },
  { name: 'Del Valle', slug: 'del-valle' },
];

const AMENITIES = [
  { code: 'wifi', name: 'Internet' },
  { code: 'parking', name: 'Estacionamiento' },
  { code: 'pet_friendly', name: 'Acepta mascotas' },
];

const USERS: SeedUserDefinition[] = [
  {
    email: 'ana.seed@matchroom.local',
    photoStorageKey: 'seeds/ana-profile.jpg',
    profile: {
      firstName: 'Ana',
      lastName: 'López',
      birthDate: '1998-04-21',
      gender: 'female',
      bio: 'Diseñadora, tranquila y ordenada. Busco compartir un departamento en Roma o Condesa.',
      occupation: 'Diseñadora gráfica',
      contactPhone: '+525512345678',
      lookingFor: 'both',
    },
    lifestyle: {
      cleanlinessLevel: 4,
      smokes: false,
      hasPets: true,
      noiseLevel: 2,
      visitsFrequency: 'sometimes',
      sleepSchedule: 'regular',
      workSchedule: 'remote',
      cohabitationType: 'any',
    },
    roommate: {
      smokingPolicy: 'reject',
      petsPolicy: 'accept',
      maxNoiseLevel: 3,
      maxVisitsFrequency: 'sometimes',
      minCleanlinessLevel: 3,
      minAge: 23,
      maxAge: 35,
      exclusiveCriteria: ['smoking', 'pets'],
    },
    housing: {
      propertyType: 'apartment',
      budgetMin: '5000.00',
      budgetMax: '9000.00',
      moveInDate: '2026-12-01',
      requiresFurnished: true,
      requiresPetsAllowed: true,
    },
    zoneSlugs: ['roma-norte', 'condesa', 'del-valle'],
    amenityCodes: ['wifi', 'parking', 'pet_friendly'],
  },
  {
    email: 'luis.seed@matchroom.local',
    photoStorageKey: 'seeds/luis-profile.jpg',
    profile: {
      firstName: 'Luis',
      lastName: 'Ramírez',
      birthDate: '1996-09-12',
      gender: 'male',
      bio: 'Ingeniero de software. Busco un roomie para compartir departamento cerca del trabajo.',
      occupation: 'Ingeniero de software',
      contactPhone: '+525587654321',
      lookingFor: 'roommate',
    },
    lifestyle: {
      cleanlinessLevel: 3,
      smokes: false,
      hasPets: false,
      noiseLevel: 3,
      visitsFrequency: 'rare',
      sleepSchedule: 'late',
      workSchedule: 'flexible',
      cohabitationType: 'find_place_together',
    },
    roommate: {
      smokingPolicy: 'reject',
      petsPolicy: 'indifferent',
      maxNoiseLevel: 2,
      maxVisitsFrequency: 'rare',
      minCleanlinessLevel: 4,
      minAge: 22,
      maxAge: 32,
      exclusiveCriteria: ['smoking'],
    },
    housing: {
      propertyType: 'room',
      budgetMin: '3500.00',
      budgetMax: '6500.00',
      moveInDate: '2027-01-15',
      requiresFurnished: true,
      requiresPetsAllowed: false,
    },
    zoneSlugs: ['roma-norte', 'del-valle'],
    amenityCodes: ['wifi', 'pet_friendly'],
  },
];

async function findOrCreateCity(): Promise<City> {
  const repository = AppDataSource.getRepository(City);
  const existing = await repository.findOneBy({
    name: CITY.name,
    stateName: CITY.stateName,
  });

  if (existing) {
    return existing;
  }

  return repository.save(repository.create(CITY));
}

async function findOrCreateZones(city: City): Promise<Map<string, Zone>> {
  const repository = AppDataSource.getRepository(Zone);
  const result = new Map<string, Zone>();

  for (const definition of ZONES) {
    const existing = await repository.findOneBy({
      cityId: city.id,
      slug: definition.slug,
    });

    const zone =
      existing ??
      (await repository.save(
        repository.create({
          cityId: city.id,
          name: definition.name,
          slug: definition.slug,
        }),
      ));

    result.set(definition.slug, zone);
  }

  return result;
}

async function findOrCreateAmenities(): Promise<Map<string, Amenity>> {
  const repository = AppDataSource.getRepository(Amenity);
  const result = new Map<string, Amenity>();

  for (const definition of AMENITIES) {
    const existing = await repository.findOneBy({ code: definition.code });

    const amenity =
      existing ??
      (await repository.save(repository.create(definition)));

    result.set(definition.code, amenity);
  }

  return result;
}

async function findOrCreateUser(email: string): Promise<User> {
  const repository = AppDataSource.getRepository(User);
  const existing = await repository.findOneBy({ email });

  if (existing) {
    return existing;
  }

  return repository.save(
    repository.create({
      email,
      emailVerifiedAt: new Date(),
      status: 'active',
      activeMode: 'seeker',
    }),
  );
}

async function findOrCreatePhoto(
  userId: string,
  storageKey: string,
): Promise<MediaAsset> {
  const repository = AppDataSource.getRepository(MediaAsset);
  const existing = await repository.findOneBy({ storageKey });

  if (existing) {
    return existing;
  }

  return repository.save(
    repository.create({
      ownerUserId: userId,
      kind: 'profile_photo',
      storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      moderationStatus: 'approved',
    }),
  );
}

async function seedUser(
  definition: SeedUserDefinition,
  city: City,
  zones: Map<string, Zone>,
  amenities: Map<string, Amenity>,
): Promise<User> {
  const user = await findOrCreateUser(definition.email);
  const photo = await findOrCreatePhoto(
    user.id,
    definition.photoStorageKey,
  );

  const profileRepository = AppDataSource.getRepository(Profile);
  const existingProfile = await profileRepository.findOneBy({
    userId: user.id,
  });
  const profile = existingProfile ?? profileRepository.create({ userId: user.id });

  profileRepository.merge(profile, {
    ...definition.profile,
    cityId: city.id,
    photoAssetId: photo.id,
  });
  await profileRepository.save(profile);

  const lifestyleRepository = AppDataSource.getRepository(LifestyleProfile);
  const existingLifestyle = await lifestyleRepository.findOneBy({
    userId: user.id,
  });
  const lifestyle =
    existingLifestyle ?? lifestyleRepository.create({ userId: user.id });
  lifestyleRepository.merge(lifestyle, definition.lifestyle);
  await lifestyleRepository.save(lifestyle);

  const roommateRepository = AppDataSource.getRepository(RoommatePreference);
  const existingRoommate = await roommateRepository.findOneBy({
    userId: user.id,
  });
  const roommate =
    existingRoommate ?? roommateRepository.create({ userId: user.id });
  roommateRepository.merge(roommate, definition.roommate);
  await roommateRepository.save(roommate);

  const housingRepository = AppDataSource.getRepository(HousingPreference);
  const existingHousing = await housingRepository.findOneBy({
    userId: user.id,
  });
  const housing =
    existingHousing ?? housingRepository.create({ userId: user.id });
  housingRepository.merge(housing, definition.housing);
  await housingRepository.save(housing);

  const preferredZoneRepository =
    AppDataSource.getRepository(UserPreferredZone);
  await preferredZoneRepository.delete({ userId: user.id });
  await preferredZoneRepository.insert(
    definition.zoneSlugs.map((slug) => {
      const zone = zones.get(slug);
      if (!zone) {
        throw new Error(`Missing seed zone: ${slug}`);
      }
      return { userId: user.id, zoneId: zone.id };
    }),
  );

  const preferredAmenityRepository =
    AppDataSource.getRepository(HousingPreferenceAmenity);
  await preferredAmenityRepository.delete({ userId: user.id });
  await preferredAmenityRepository.insert(
    definition.amenityCodes.map((code) => {
      const amenity = amenities.get(code);
      if (!amenity) {
        throw new Error(`Missing seed amenity: ${code}`);
      }
      return { userId: user.id, amenityId: amenity.id };
    }),
  );

  const privacyRepository = AppDataSource.getRepository(PrivacySetting);
  const existingPrivacy = await privacyRepository.findOneBy({
    userId: user.id,
  });
  const privacy =
    existingPrivacy ?? privacyRepository.create({ userId: user.id });
  privacyRepository.merge(privacy, {
    appearInSearch: true,
    profileVisibility: 'everyone',
    showExactAge: true,
    showOccupation: true,
    showPhoto: true,
    showHousingPreferences: true,
  });
  await privacyRepository.save(privacy);

  const completenessService = new ProfileCompletenessService();
  const [savedProfile, savedLifestyle, savedRoommate, savedHousing] =
    await Promise.all([
      profileRepository.findOneBy({ userId: user.id }),
      lifestyleRepository.findOneBy({ userId: user.id }),
      roommateRepository.findOneBy({ userId: user.id }),
      housingRepository.findOneBy({ userId: user.id }),
    ]);
  const preferredZonesCount = await preferredZoneRepository.countBy({
    userId: user.id,
  });
  const preferredAmenitiesCount = await preferredAmenityRepository.countBy({
    userId: user.id,
  });

  const { completenessPct } = completenessService.calculate({
    profile: savedProfile,
    lifestyle: savedLifestyle,
    roommatePreferences: savedRoommate,
    housingPreferences: savedHousing,
    preferredZonesCount,
    preferredAmenitiesCount,
  });

  await profileRepository.update({ userId: user.id }, { completenessPct });

  return user;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const city = await findOrCreateCity();
    const zones = await findOrCreateZones(city);
    const amenities = await findOrCreateAmenities();

    const seededUsers: User[] = [];
    for (const definition of USERS) {
      seededUsers.push(
        await seedUser(definition, city, zones, amenities),
      );
    }

    console.log('Seed completed.');
    console.log(`City: ${city.name} (${city.id})`);
    for (const user of seededUsers) {
      console.log(`User: ${user.email} (${user.id})`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
