import { Amenity, City, Zone } from '../../../catalog/domain/entities/index.js';
import type {
  HousingPreference,
  LifestyleProfile,
  RoommatePreference,
} from '../../domain/entities/index.js';
import {
  AmenitySummaryDto,
  CitySummaryDto,
  HousingPreferencesResponseDto,
  LifestyleResponseDto,
  RoommatePreferencesResponseDto,
  ZoneSummaryDto,
} from '../dto/profile-response.dto.js';

export function toCitySummary(city: City): CitySummaryDto {
  return {
    id: city.id,
    name: city.name,
    stateName: city.stateName,
  };
}

export function toZoneSummary(zone: Zone): ZoneSummaryDto {
  return { id: zone.id, name: zone.name };
}

export function toAmenitySummary(amenity: Amenity): AmenitySummaryDto {
  return {
    id: amenity.id,
    code: amenity.code,
    name: amenity.name,
  };
}

export function toLifestyleResponse(
  lifestyle: LifestyleProfile,
): LifestyleResponseDto {
  return {
    cleanlinessLevel: lifestyle.cleanlinessLevel,
    smokes: lifestyle.smokes,
    hasPets: lifestyle.hasPets,
    noiseLevel: lifestyle.noiseLevel,
    visitsFrequency: lifestyle.visitsFrequency,
    sleepSchedule: lifestyle.sleepSchedule,
    workSchedule: lifestyle.workSchedule,
    cohabitationType: lifestyle.cohabitationType,
    updatedAt: lifestyle.updatedAt.toISOString(),
  };
}

export function toRoommatePreferencesResponse(
  preferences: RoommatePreference,
): RoommatePreferencesResponseDto {
  return {
    smokingPolicy: preferences.smokingPolicy,
    petsPolicy: preferences.petsPolicy,
    maxNoiseLevel: preferences.maxNoiseLevel,
    maxVisitsFrequency: preferences.maxVisitsFrequency,
    minCleanlinessLevel: preferences.minCleanlinessLevel,
    minAge: preferences.minAge,
    maxAge: preferences.maxAge,
    exclusiveCriteria: preferences.exclusiveCriteria,
    updatedAt: preferences.updatedAt.toISOString(),
  };
}

export function toHousingPreferencesResponse(
  preferences: HousingPreference,
): HousingPreferencesResponseDto {
  return {
    propertyType: preferences.propertyType,
    budgetMin: preferences.budgetMin,
    budgetMax: preferences.budgetMax,
    moveInDate: preferences.moveInDate,
    requiresFurnished: preferences.requiresFurnished,
    requiresPetsAllowed: preferences.requiresPetsAllowed,
    updatedAt: preferences.updatedAt.toISOString(),
  };
}
