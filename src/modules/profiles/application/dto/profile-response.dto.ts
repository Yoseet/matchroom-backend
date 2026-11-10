import { ApiProperty } from '@nestjs/swagger';
import type {
  CohabitationType,
  ExclusiveCriterion,
  HousingPropertyType,
  LookingFor,
  PolicyPreference,
  SleepSchedule,
  VisitsFrequency,
  WorkSchedule,
} from '../../domain/entities/index.js';

export class CitySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Guadalajara' })
  name: string;

  @ApiProperty({ example: 'Jalisco' })
  stateName: string;
}

export class ZoneSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Providencia' })
  name: string;
}

export class AmenitySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'internet' })
  code: string;

  @ApiProperty({ example: 'Internet' })
  name: string;
}

export class LifestyleResponseDto {
  @ApiProperty({ minimum: 1, maximum: 5, nullable: true })
  cleanlinessLevel: number | null;

  @ApiProperty({ nullable: true })
  smokes: boolean | null;

  @ApiProperty({ nullable: true })
  hasPets: boolean | null;

  @ApiProperty({ minimum: 1, maximum: 5, nullable: true })
  noiseLevel: number | null;

  @ApiProperty({
    enum: ['never', 'rare', 'sometimes', 'often'],
    nullable: true,
  })
  visitsFrequency: VisitsFrequency | null;

  @ApiProperty({ enum: ['early', 'regular', 'late'], nullable: true })
  sleepSchedule: SleepSchedule | null;

  @ApiProperty({
    enum: ['morning', 'afternoon', 'night', 'remote', 'flexible'],
    nullable: true,
  })
  workSchedule: WorkSchedule | null;

  @ApiProperty({
    enum: ['join_existing_home', 'find_place_together', 'any'],
    nullable: true,
  })
  cohabitationType: CohabitationType | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class RoommatePreferencesResponseDto {
  @ApiProperty({ enum: ['accept', 'reject', 'indifferent'], nullable: true })
  smokingPolicy: PolicyPreference | null;

  @ApiProperty({ enum: ['accept', 'reject', 'indifferent'], nullable: true })
  petsPolicy: PolicyPreference | null;

  @ApiProperty({ minimum: 1, maximum: 5, nullable: true })
  maxNoiseLevel: number | null;

  @ApiProperty({
    enum: ['never', 'rare', 'sometimes', 'often'],
    nullable: true,
  })
  maxVisitsFrequency: VisitsFrequency | null;

  @ApiProperty({ minimum: 1, maximum: 5, nullable: true })
  minCleanlinessLevel: number | null;

  @ApiProperty({ minimum: 18, maximum: 120, nullable: true })
  minAge: number | null;

  @ApiProperty({ minimum: 18, maximum: 120, nullable: true })
  maxAge: number | null;

  @ApiProperty({
    enum: [
      'smoking',
      'pets',
      'noise',
      'visits',
      'cleanliness',
      'age',
    ],
    isArray: true,
  })
  exclusiveCriteria: ExclusiveCriterion[];

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class HousingPreferencesResponseDto {
  @ApiProperty({ enum: ['room', 'apartment', 'any'], nullable: true })
  propertyType: HousingPropertyType | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'numeric(12,2) serializado como texto',
    example: '5000.00',
  })
  budgetMin: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'numeric(12,2) serializado como texto',
    example: '9000.00',
  })
  budgetMax: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  moveInDate: string | null;

  @ApiProperty({ nullable: true, description: 'null significa indiferente.' })
  requiresFurnished: boolean | null;

  @ApiProperty({ nullable: true })
  requiresPetsAllowed: boolean | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class OwnProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ nullable: true })
  firstName: string | null;

  @ApiProperty({ nullable: true })
  lastName: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  birthDate: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Edad calculada a partir de birthDate.',
  })
  age: number | null;

  @ApiProperty({ nullable: true })
  gender: string | null;

  @ApiProperty({ nullable: true, maxLength: 500 })
  bio: string | null;

  @ApiProperty({ nullable: true })
  occupation: string | null;

  @ApiProperty({ nullable: true })
  contactPhone: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  photoAssetId: string | null;

  @ApiProperty({ enum: ['roommate', 'housing', 'both'] })
  lookingFor: LookingFor;

  @ApiProperty({ format: 'uuid', nullable: true })
  cityId: string | null;

  @ApiProperty({ type: CitySummaryDto, nullable: true })
  city: CitySummaryDto | null;

  @ApiProperty({ minimum: 0, maximum: 100 })
  completenessPct: number;

  @ApiProperty({ type: LifestyleResponseDto, nullable: true })
  lifestyle: LifestyleResponseDto | null;

  @ApiProperty({ type: RoommatePreferencesResponseDto, nullable: true })
  roommatePreferences: RoommatePreferencesResponseDto | null;

  @ApiProperty({ type: HousingPreferencesResponseDto, nullable: true })
  housingPreferences: HousingPreferencesResponseDto | null;

  @ApiProperty({ type: [ZoneSummaryDto] })
  preferredZones: ZoneSummaryDto[];

  @ApiProperty({ type: [AmenitySummaryDto] })
  preferredAmenities: AmenitySummaryDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class PreferredZonesResponseDto {
  @ApiProperty({ type: [ZoneSummaryDto] })
  preferredZones: ZoneSummaryDto[];
}

export class PreferredAmenitiesResponseDto {
  @ApiProperty({ type: [AmenitySummaryDto] })
  preferredAmenities: AmenitySummaryDto[];
}
