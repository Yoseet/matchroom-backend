import { describe, expect, it } from 'vitest';
import type {
  HousingPreference,
  LifestyleProfile,
  Profile,
  RoommatePreference,
} from '../../domain/entities/index.js';
import {
  ProfileCompletenessService,
  type ProfileCompletenessInput,
} from './profile-completeness.service.js';

const service = new ProfileCompletenessService();

const emptyInput = (): ProfileCompletenessInput => ({
  profile: {
    firstName: null,
    lastName: null,
    birthDate: null,
    bio: null,
    occupation: null,
    contactPhone: null,
    cityId: null,
    photoAssetId: null,
  } as Profile,
  lifestyle: null,
  roommatePreferences: null,
  housingPreferences: null,
  preferredZonesCount: 0,
  preferredAmenitiesCount: 0,
});

const completeInput = (): ProfileCompletenessInput => ({
  profile: {
    firstName: 'Ana',
    lastName: 'Pérez',
    birthDate: '1997-03-14',
    bio: 'Busco roomie tranquilo.',
    occupation: 'Diseñadora',
    contactPhone: '+525512345678',
    cityId: '018f3b1a-8f24-4b35-a1c2-3d4e5f607182',
    photoAssetId: '018f3b1a-8f24-4b35-a1c2-3d4e5f607183',
  } as Profile,
  lifestyle: {
    cleanlinessLevel: 4,
    smokes: false,
    hasPets: true,
    noiseLevel: 2,
    visitsFrequency: 'sometimes',
  } as LifestyleProfile,
  roommatePreferences: {
    smokingPolicy: 'reject',
    petsPolicy: 'accept',
    maxNoiseLevel: 3,
    maxVisitsFrequency: 'sometimes',
    minCleanlinessLevel: 3,
  } as RoommatePreference,
  housingPreferences: {
    propertyType: 'apartment',
    budgetMin: '5000.00',
    budgetMax: '9000.00',
    moveInDate: '2026-12-01',
  } as HousingPreference,
  preferredZonesCount: 2,
  preferredAmenitiesCount: 3,
});

describe('ProfileCompletenessService', () => {
  it('returns 0 and every missing field for an empty profile', () => {
    const result = service.calculate(emptyInput());

    expect(result.completenessPct).toBe(0);
    expect(result.missingFields).toHaveLength(23);
    expect(result.missingFields[0]).toMatchObject({
      section: 'personal',
      field: 'firstName',
    });
    expect(result.missingFields.at(-1)).toMatchObject({
      section: 'amenities',
      field: 'preferredAmenities',
    });
  });

  it('returns 100 when every weighted field is present', () => {
    const result = service.calculate(completeInput());

    expect(result.completenessPct).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it('weights personal data as 40 percent', () => {
    const input = emptyInput();
    input.profile = completeInput().profile;

    const result = service.calculate(input);

    expect(result.completenessPct).toBe(40);
    expect(
      result.missingFields.some((field) => field.section === 'personal'),
    ).toBe(false);
  });

  it('counts false booleans and zero-valued levels as complete', () => {
    const input = emptyInput();
    input.lifestyle = {
      cleanlinessLevel: 1,
      smokes: false,
      hasPets: false,
      noiseLevel: 1,
      visitsFrequency: 'never',
    } as LifestyleProfile;

    const result = service.calculate(input);

    expect(result.completenessPct).toBe(20);
    expect(
      result.missingFields.some((field) => field.section === 'lifestyle'),
    ).toBe(false);
  });

  it('requires both budget bounds for the housing budget field', () => {
    const input = emptyInput();
    input.housingPreferences = {
      propertyType: 'room',
      budgetMin: '5000.00',
      budgetMax: null,
      moveInDate: '2026-12-01',
    } as HousingPreference;

    const result = service.calculate(input);

    expect(result.completenessPct).toBe(10);
    expect(result.missingFields).toContainEqual({
      section: 'housing_preferences',
      field: 'budget',
      label: 'Presupuesto mínimo y máximo',
    });
  });

  it('adds 10 points when zones and amenities are selected', () => {
    const input = emptyInput();
    input.preferredZonesCount = 1;
    input.preferredAmenitiesCount = 1;

    const result = service.calculate(input);

    expect(result.completenessPct).toBe(10);
    expect(result.missingFields).toHaveLength(21);
  });

  it('weights roommate preferences as 15 percent', () => {
    const input = emptyInput();
    input.roommatePreferences = {
      smokingPolicy: 'accept',
      petsPolicy: 'indifferent',
      maxNoiseLevel: 5,
      maxVisitsFrequency: 'often',
      minCleanlinessLevel: 1,
      minAge: 30,
      maxAge: 40,
    } as RoommatePreference;

    const result = service.calculate(input);

    expect(result.completenessPct).toBe(15);
    expect(
      result.missingFields.some(
        (field) => field.section === 'roommate_preferences',
      ),
    ).toBe(false);
  });
});
