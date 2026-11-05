import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  HousingPreference,
  HousingPreferenceAmenity,
  LifestyleProfile,
  Profile,
  RoommatePreference,
  UserPreferredZone,
} from './domain/entities/index.js';
import { ProfilesService } from './application/services/profiles.service.js';

/**
 * Profiles bounded context: public profile plus lifestyle, roommate and
 * housing preferences used by the compatibility engine.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Profile,
      LifestyleProfile,
      RoommatePreference,
      HousingPreference,
      UserPreferredZone,
      HousingPreferenceAmenity,
    ]),
  ],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
