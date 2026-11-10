import { ApiProperty } from '@nestjs/swagger';
import type { LookingFor } from '../../domain/entities/index.js';
import {
  AmenitySummaryDto,
  CitySummaryDto,
  HousingPreferencesResponseDto,
  LifestyleResponseDto,
  RoommatePreferencesResponseDto,
  ZoneSummaryDto,
} from './profile-response.dto.js';

/**
 * Public projection of a profile. Privacy settings decide which optional
 * blocks are present; `looking_for` decides whether roommate and/or housing
 * data is relevant.
 */
export class PublicProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ nullable: true })
  firstName: string | null;

  @ApiProperty({ nullable: true })
  lastName: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Edad exacta solo si privacy_settings.show_exact_age es true; en caso ' +
      'contrario se devuelve null.',
  })
  age: number | null;

  @ApiProperty({ nullable: true })
  gender: string | null;

  @ApiProperty({ nullable: true, maxLength: 500 })
  bio: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Se oculta si privacy_settings.show_occupation es false.',
  })
  occupation: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Se oculta si privacy_settings.show_photo es false.',
  })
  photoAssetId: string | null;

  @ApiProperty({ enum: ['roommate', 'housing', 'both'] })
  lookingFor: LookingFor;

  @ApiProperty({ type: CitySummaryDto, nullable: true })
  city: CitySummaryDto | null;

  @ApiProperty({ minimum: 0, maximum: 100 })
  completenessPct: number;

  @ApiProperty({
    type: LifestyleResponseDto,
    nullable: true,
    description:
      'Presente solo si el perfil busca roomie o ambas cosas.',
  })
  lifestyle: LifestyleResponseDto | null;

  @ApiProperty({
    type: RoommatePreferencesResponseDto,
    nullable: true,
    description:
      'Presente solo si el perfil busca roomie o ambas cosas.',
  })
  roommatePreferences: RoommatePreferencesResponseDto | null;

  @ApiProperty({
    type: HousingPreferencesResponseDto,
    nullable: true,
    description:
      'Presente si el perfil busca vivienda o ambas cosas y ' +
      'show_housing_preferences es true.',
  })
  housingPreferences: HousingPreferencesResponseDto | null;

  @ApiProperty({ type: [ZoneSummaryDto] })
  preferredZones: ZoneSummaryDto[];

  @ApiProperty({
    type: [AmenitySummaryDto],
    nullable: true,
    description:
      'Presente si el perfil busca vivienda o ambas cosas y ' +
      'show_housing_preferences es true.',
  })
  preferredAmenities: AmenitySummaryDto[] | null;
}

export class ListProfilesResponseDto {
  @ApiProperty({ type: [PublicProfileResponseDto] })
  data: PublicProfileResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor para la siguiente página, o null al terminar.',
  })
  nextCursor: string | null;
}
