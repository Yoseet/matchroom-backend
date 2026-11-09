import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileCompletenessService } from './application/services/profile-completeness.service.js';
import { ProfilesService } from './application/services/profiles.service.js';
import { PublicProfilesService } from './application/services/public-profiles.service.js';
import {
  HousingPreference,
  HousingPreferenceAmenity,
  LifestyleProfile,
  Profile,
  RoommatePreference,
  UserPreferredZone,
} from './domain/entities/index.js';
import { ProfilesController } from './presentation/controllers/profiles.controller.js';

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
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    ProfileCompletenessService,
    PublicProfilesService,
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
