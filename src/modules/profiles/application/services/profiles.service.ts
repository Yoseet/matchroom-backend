import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Repository,
} from 'typeorm';
import { User } from '../../../accounts/domain/entities/index.js';
import { City, Zone, Amenity } from '../../../catalog/domain/entities/index.js';
import { MediaAsset } from '../../../media/domain/entities/index.js';
import {
  HousingPreference,
  HousingPreferenceAmenity,
  LifestyleProfile,
  Profile,
  RoommatePreference,
  UserPreferredZone,
} from '../../domain/entities/index.js';
import { UpdateHousingPreferencesDto } from '../dto/update-housing-preferences.dto.js';
import { UpdateLifestyleDto } from '../dto/update-lifestyle.dto.js';
import {
  AddPreferredAmenitiesDto,
  UpdatePreferredAmenitiesDto,
} from '../dto/update-preferred-amenities.dto.js';
import {
  AddPreferredZonesDto,
  UpdatePreferredZonesDto,
} from '../dto/update-preferred-zones.dto.js';
import { UpdateProfileDto } from '../dto/update-profile.dto.js';
import { UpdateRoommatePreferencesDto } from '../dto/update-roommate-preferences.dto.js';
import {
  HousingPreferencesResponseDto,
  LifestyleResponseDto,
  OwnProfileResponseDto,
  PreferredAmenitiesResponseDto,
  PreferredZonesResponseDto,
  RoommatePreferencesResponseDto,
} from '../dto/profile-response.dto.js';
import { ProfileCompletenessResponseDto } from '../dto/profile-completeness-response.dto.js';
import { calculateAge, parseDateOnly } from './profile-age.util.js';
import {
  ProfileCompletenessInput,
  ProfileCompletenessService,
} from './profile-completeness.service.js';
import {
  toAmenitySummary,
  toCitySummary,
  toHousingPreferencesResponse,
  toLifestyleResponse,
  toRoommatePreferencesResponse,
  toZoneSummary,
} from './profile-response.mapper.js';

const MINIMUM_AGE = 18;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(LifestyleProfile)
    private readonly lifestyleRepository: Repository<LifestyleProfile>,
    @InjectRepository(RoommatePreference)
    private readonly roommateRepository: Repository<RoommatePreference>,
    @InjectRepository(HousingPreference)
    private readonly housingRepository: Repository<HousingPreference>,
    @InjectRepository(UserPreferredZone)
    private readonly preferredZoneRepository: Repository<UserPreferredZone>,
    @InjectRepository(HousingPreferenceAmenity)
    private readonly preferredAmenityRepository: Repository<HousingPreferenceAmenity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly completenessService: ProfileCompletenessService,
  ) {}

  /**
   * Creates the empty profile that accompanies a new user. Used by the
   * accounts module during registration; existing rows are left untouched.
   */
  async createEmpty(
    userId: string,
    manager?: EntityManager,
  ): Promise<Profile> {
    const repository = manager
      ? manager.getRepository(Profile)
      : this.profileRepository;

    const existing = await repository.findOneBy({ userId });
    if (existing) {
      return existing;
    }

    return repository.save(
      repository.create({
        userId,
        lookingFor: 'both',
        completenessPct: 0,
      }),
    );
  }

  /**
   * Explicit profile creation for the current user. Registration creates the
   * empty row through `createEmpty`; this endpoint fails when a profile
   * already exists so callers can distinguish creation from updates.
   */
  async createProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<OwnProfileResponseDto> {
    const patch = this.buildProfilePatch(dto);

    await this.dataSource.transaction(async (manager) => {
      const userExists = await manager
        .getRepository(User)
        .existsBy({ id: userId });

      if (!userExists) {
        throw new NotFoundException('User not found');
      }

      const repository = manager.getRepository(Profile);
      const existingProfile = await repository.findOneBy({ userId });

      if (existingProfile) {
        throw new ConflictException('Profile already exists');
      }

      if (patch.birthDate !== undefined && patch.birthDate !== null) {
        this.assertAdultBirthDate(patch.birthDate);
      }

      if (patch.cityId) {
        await this.assertCityExists(patch.cityId, manager);
      }

      if (patch.photoAssetId) {
        await this.assertOwnProfilePhoto(patch.photoAssetId, userId, manager);
      }

      const profile = repository.create({
        userId,
        lookingFor: 'both',
        completenessPct: 0,
        ...patch,
      });

      await repository.save(profile);
      await this.recalculateCompleteness(userId, manager);
    });

    return this.getOwnProfile(userId);
  }

  async getOwnProfile(userId: string): Promise<OwnProfileResponseDto> {
    const profile = await this.profileRepository.findOneBy({ userId });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const [
      lifestyle,
      roommatePreferences,
      housingPreferences,
      zoneLinks,
      amenityLinks,
    ] = await Promise.all([
      this.lifestyleRepository.findOneBy({ userId }),
      this.roommateRepository.findOneBy({ userId }),
      this.housingRepository.findOneBy({ userId }),
      this.preferredZoneRepository.findBy({ userId }),
      this.preferredAmenityRepository.findBy({ userId }),
    ]);

    const [city, zones, amenities] = await Promise.all([
      this.loadCity(profile.cityId),
      this.loadZones(zoneLinks),
      this.loadAmenities(amenityLinks),
    ]);

    return {
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      birthDate: profile.birthDate,
      age: calculateAge(profile.birthDate),
      gender: profile.gender,
      bio: profile.bio,
      occupation: profile.occupation,
      contactPhone: profile.contactPhone,
      photoAssetId: profile.photoAssetId,
      lookingFor: profile.lookingFor,
      cityId: profile.cityId,
      city: city ? toCitySummary(city) : null,
      completenessPct: profile.completenessPct,
      lifestyle: lifestyle ? toLifestyleResponse(lifestyle) : null,
      roommatePreferences: roommatePreferences
        ? toRoommatePreferencesResponse(roommatePreferences)
        : null,
      housingPreferences: housingPreferences
        ? toHousingPreferencesResponse(housingPreferences)
        : null,
      preferredZones: zones.map((zone) => toZoneSummary(zone)),
      preferredAmenities: amenities.map((amenity) =>
        toAmenitySummary(amenity),
      ),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<OwnProfileResponseDto> {
    const patch = this.buildProfilePatch(dto);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Profile);
      const existingProfile = await repository.findOneBy({ userId });

      if (!existingProfile) {
        const userExists = await manager
          .getRepository(User)
          .existsBy({ id: userId });

        if (!userExists) {
          throw new NotFoundException('User not found');
        }
      }

      const profile =
        existingProfile ??
        repository.create({
          userId,
          lookingFor: 'both',
          completenessPct: 0,
        });

      if (patch.birthDate !== undefined && patch.birthDate !== null) {
        this.assertAdultBirthDate(patch.birthDate);
      }

      if (patch.cityId) {
        await this.assertCityExists(patch.cityId, manager);
      }

      if (patch.photoAssetId) {
        await this.assertOwnProfilePhoto(patch.photoAssetId, userId, manager);
      }

      if (
        patch.cityId !== undefined &&
        patch.cityId !== profile.cityId
      ) {
        await this.prunePreferredZonesOutsideCity(
          userId,
          patch.cityId,
          manager,
        );
      }

      repository.merge(profile, patch);
      await repository.save(profile);
      await this.recalculateCompleteness(userId, manager);
    });

    return this.getOwnProfile(userId);
  }

  async createLifestyle(
    userId: string,
    dto: UpdateLifestyleDto,
  ): Promise<LifestyleResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);

      const repository = manager.getRepository(LifestyleProfile);
      const existing = await repository.findOneBy({ userId });

      if (existing) {
        throw new ConflictException('Lifestyle profile already exists');
      }

      const entity = repository.create({ userId });
      this.applyLifestyle(entity, dto);

      const persisted = await repository.save(entity);
      await this.recalculateCompleteness(userId, manager);
      return persisted;
    });

    return toLifestyleResponse(saved);
  }

  async updateLifestyle(
    userId: string,
    dto: UpdateLifestyleDto,
  ): Promise<LifestyleResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);

      const repository = manager.getRepository(LifestyleProfile);
      const existing = await repository.findOneBy({ userId });
      const entity = existing ?? repository.create({ userId });

      this.applyLifestyle(entity, dto);

      const persisted = await repository.save(entity);
      await this.recalculateCompleteness(userId, manager);
      return persisted;
    });

    return toLifestyleResponse(saved);
  }

  async createRoommatePreferences(
    userId: string,
    dto: UpdateRoommatePreferencesDto,
  ): Promise<RoommatePreferencesResponseDto> {
    this.assertRoommateAgeRange(dto);

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);

      const repository = manager.getRepository(RoommatePreference);
      const existing = await repository.findOneBy({ userId });

      if (existing) {
        throw new ConflictException('Roommate preferences already exist');
      }

      const entity = repository.create({ userId });
      this.applyRoommatePreferences(entity, dto);

      const persisted = await repository.save(entity);
      await this.recalculateCompleteness(userId, manager);
      return persisted;
    });

    return toRoommatePreferencesResponse(saved);
  }

  async updateRoommatePreferences(
    userId: string,
    dto: UpdateRoommatePreferencesDto,
  ): Promise<RoommatePreferencesResponseDto> {
    this.assertRoommateAgeRange(dto);

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);

      const repository = manager.getRepository(RoommatePreference);
      const existing = await repository.findOneBy({ userId });
      const entity = existing ?? repository.create({ userId });

      this.applyRoommatePreferences(entity, dto);

      const persisted = await repository.save(entity);
      await this.recalculateCompleteness(userId, manager);
      return persisted;
    });

    return toRoommatePreferencesResponse(saved);
  }

  async createHousingPreferences(
    userId: string,
    dto: UpdateHousingPreferencesDto,
  ): Promise<HousingPreferencesResponseDto> {
    this.assertHousingBudgetRange(dto);

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);

      const repository = manager.getRepository(HousingPreference);
      const existing = await repository.findOneBy({ userId });

      if (existing) {
        throw new ConflictException('Housing preferences already exist');
      }

      const entity = repository.create({ userId });
      this.applyHousingPreferences(entity, dto);

      const persisted = await repository.save(entity);
      await this.recalculateCompleteness(userId, manager);
      return persisted;
    });

    return toHousingPreferencesResponse(saved);
  }

  async updateHousingPreferences(
    userId: string,
    dto: UpdateHousingPreferencesDto,
  ): Promise<HousingPreferencesResponseDto> {
    this.assertHousingBudgetRange(dto);

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);

      const repository = manager.getRepository(HousingPreference);
      const existing = await repository.findOneBy({ userId });
      const entity = existing ?? repository.create({ userId });

      this.applyHousingPreferences(entity, dto);

      const persisted = await repository.save(entity);
      await this.recalculateCompleteness(userId, manager);
      return persisted;
    });

    return toHousingPreferencesResponse(saved);
  }

  async replacePreferredZones(
    userId: string,
    dto: UpdatePreferredZonesDto,
  ): Promise<PreferredZonesResponseDto> {
    const zones = await this.dataSource.transaction(async (manager) => {
      const profile = await this.assertProfileExists(userId, manager);
      const zoneIds = [...new Set(dto.zoneIds)];
      const selectedZones = await this.assertPreferredZonesSelectable(
        zoneIds,
        profile.cityId,
        manager,
      );

      const repository = manager.getRepository(UserPreferredZone);
      await repository.delete({ userId });

      if (zoneIds.length > 0) {
        await repository.insert(
          zoneIds.map((zoneId) => ({ userId, zoneId })),
        );
      }

      await this.recalculateCompleteness(userId, manager);
      return selectedZones;
    });

    return {
      preferredZones: zones.map((zone) => toZoneSummary(zone)),
    };
  }

  /**
   * Appends zones to the current selection. Existing links are ignored so the
   * operation is idempotent; use PUT to replace the full selection.
   */
  async addPreferredZones(
    userId: string,
    dto: AddPreferredZonesDto,
  ): Promise<PreferredZonesResponseDto> {
    const zones = await this.dataSource.transaction(async (manager) => {
      const profile = await this.assertProfileExists(userId, manager);
      const zoneIds = [...new Set(dto.zoneIds)];

      await this.assertPreferredZonesSelectable(
        zoneIds,
        profile.cityId,
        manager,
      );

      const repository = manager.getRepository(UserPreferredZone);
      await repository
        .createQueryBuilder()
        .insert()
        .into(UserPreferredZone)
        .values(zoneIds.map((zoneId) => ({ userId, zoneId })))
        .orIgnore()
        .execute();

      await this.recalculateCompleteness(userId, manager);
      return this.loadZones(await repository.findBy({ userId }), manager);
    });

    return {
      preferredZones: zones.map((zone) => toZoneSummary(zone)),
    };
  }

  async replacePreferredAmenities(
    userId: string,
    dto: UpdatePreferredAmenitiesDto,
  ): Promise<PreferredAmenitiesResponseDto> {
    const amenities = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);
      const amenityIds = [...new Set(dto.amenityIds)];
      const selectedAmenities = await this.assertPreferredAmenitiesSelectable(
        amenityIds,
        manager,
      );

      const repository = manager.getRepository(HousingPreferenceAmenity);
      await repository.delete({ userId });

      if (amenityIds.length > 0) {
        await repository.insert(
          amenityIds.map((amenityId) => ({ userId, amenityId })),
        );
      }

      await this.recalculateCompleteness(userId, manager);
      return selectedAmenities;
    });

    return {
      preferredAmenities: amenities.map((amenity) =>
        toAmenitySummary(amenity),
      ),
    };
  }

  /**
   * Appends amenities to the current selection. Existing links are ignored so
   * the operation is idempotent; use PUT to replace the full selection.
   */
  async addPreferredAmenities(
    userId: string,
    dto: AddPreferredAmenitiesDto,
  ): Promise<PreferredAmenitiesResponseDto> {
    const amenities = await this.dataSource.transaction(async (manager) => {
      await this.assertProfileExists(userId, manager);
      const amenityIds = [...new Set(dto.amenityIds)];

      await this.assertPreferredAmenitiesSelectable(amenityIds, manager);

      const repository = manager.getRepository(HousingPreferenceAmenity);
      await repository
        .createQueryBuilder()
        .insert()
        .into(HousingPreferenceAmenity)
        .values(amenityIds.map((amenityId) => ({ userId, amenityId })))
        .orIgnore()
        .execute();

      await this.recalculateCompleteness(userId, manager);
      return this.loadAmenities(
        await repository.findBy({ userId }),
        manager,
      );
    });

    return {
      preferredAmenities: amenities.map((amenity) =>
        toAmenitySummary(amenity),
      ),
    };
  }

  async getCompleteness(
    userId: string,
  ): Promise<ProfileCompletenessResponseDto> {
    const input = await this.loadCompletenessInput(
      userId,
      this.dataSource.manager,
    );
    return this.completenessService.calculate(input);
  }

  private buildProfilePatch(dto: UpdateProfileDto): Partial<Profile> {
    const patch: Partial<Profile> = {};

    if (dto.firstName !== undefined) {
      patch.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      patch.lastName = dto.lastName;
    }
    if (dto.birthDate !== undefined) {
      patch.birthDate = dto.birthDate;
    }
    if (dto.gender !== undefined) {
      patch.gender = dto.gender;
    }
    if (dto.bio !== undefined) {
      patch.bio = dto.bio;
    }
    if (dto.occupation !== undefined) {
      patch.occupation = dto.occupation;
    }
    if (dto.contactPhone !== undefined) {
      patch.contactPhone = dto.contactPhone;
    }
    if (dto.photoAssetId !== undefined) {
      patch.photoAssetId = dto.photoAssetId;
    }
    if (dto.cityId !== undefined) {
      patch.cityId = dto.cityId;
    }
    if (dto.lookingFor !== undefined) {
      patch.lookingFor = dto.lookingFor;
    }

    return patch;
  }

  private applyLifestyle(
    entity: LifestyleProfile,
    dto: UpdateLifestyleDto,
  ): void {
    entity.cleanlinessLevel = dto.cleanlinessLevel ?? null;
    entity.smokes = dto.smokes ?? null;
    entity.hasPets = dto.hasPets ?? null;
    entity.noiseLevel = dto.noiseLevel ?? null;
    entity.visitsFrequency = dto.visitsFrequency ?? null;
    entity.sleepSchedule = dto.sleepSchedule ?? null;
    entity.workSchedule = dto.workSchedule ?? null;
    entity.cohabitationType = dto.cohabitationType ?? null;
  }

  private applyRoommatePreferences(
    entity: RoommatePreference,
    dto: UpdateRoommatePreferencesDto,
  ): void {
    entity.smokingPolicy = dto.smokingPolicy ?? null;
    entity.petsPolicy = dto.petsPolicy ?? null;
    entity.maxNoiseLevel = dto.maxNoiseLevel ?? null;
    entity.maxVisitsFrequency = dto.maxVisitsFrequency ?? null;
    entity.minCleanlinessLevel = dto.minCleanlinessLevel ?? null;
    entity.minAge = dto.minAge ?? null;
    entity.maxAge = dto.maxAge ?? null;
    entity.exclusiveCriteria = dto.exclusiveCriteria ?? [];
  }

  private applyHousingPreferences(
    entity: HousingPreference,
    dto: UpdateHousingPreferencesDto,
  ): void {
    entity.propertyType = dto.propertyType ?? null;
    entity.budgetMin = this.toMoney(dto.budgetMin);
    entity.budgetMax = this.toMoney(dto.budgetMax);
    entity.moveInDate = dto.moveInDate ?? null;
    entity.requiresFurnished = dto.requiresFurnished ?? null;
    entity.requiresPetsAllowed = dto.requiresPetsAllowed ?? null;
  }

  private assertRoommateAgeRange(
    dto: UpdateRoommatePreferencesDto,
  ): void {
    if (
      dto.minAge !== null &&
      dto.minAge !== undefined &&
      dto.maxAge !== null &&
      dto.maxAge !== undefined &&
      dto.minAge > dto.maxAge
    ) {
      throw new BadRequestException('minAge cannot be greater than maxAge');
    }
  }

  private assertHousingBudgetRange(
    dto: UpdateHousingPreferencesDto,
  ): void {
    if (
      dto.budgetMin !== null &&
      dto.budgetMin !== undefined &&
      dto.budgetMax !== null &&
      dto.budgetMax !== undefined &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw new BadRequestException(
        'budgetMin cannot be greater than budgetMax',
      );
    }
  }

  private async assertPreferredZonesSelectable(
    zoneIds: string[],
    cityId: string | null,
    manager: EntityManager,
  ): Promise<Zone[]> {
    if (zoneIds.length === 0) {
      return [];
    }

    if (!cityId) {
      throw new BadRequestException(
        'The profile must have a city before selecting preferred zones',
      );
    }

    const selectedZones = await manager.getRepository(Zone).find({
      where: { id: In(zoneIds) },
      order: { name: 'ASC' },
    });

    if (selectedZones.length !== zoneIds.length) {
      throw new BadRequestException(
        'One or more zoneIds do not reference existing zones',
      );
    }

    const invalidZone = selectedZones.find(
      (zone) => !zone.isActive || zone.cityId !== cityId,
    );

    if (invalidZone) {
      throw new BadRequestException(
        'Preferred zones must be active and belong to the profile city',
      );
    }

    return selectedZones;
  }

  private async assertPreferredAmenitiesSelectable(
    amenityIds: string[],
    manager: EntityManager,
  ): Promise<Amenity[]> {
    if (amenityIds.length === 0) {
      return [];
    }

    const selectedAmenities = await manager.getRepository(Amenity).find({
      where: { id: In(amenityIds) },
      order: { name: 'ASC' },
    });

    if (selectedAmenities.length !== amenityIds.length) {
      throw new BadRequestException(
        'One or more amenityIds do not reference existing amenities',
      );
    }

    const inactiveAmenity = selectedAmenities.find(
      (amenity) => !amenity.isActive,
    );

    if (inactiveAmenity) {
      throw new BadRequestException('Preferred amenities must be active');
    }

    return selectedAmenities;
  }

  private assertAdultBirthDate(birthDate: string): void {
    const parsed = parseDateOnly(birthDate);
    if (!parsed) {
      throw new BadRequestException(
        'birthDate must be a valid date in YYYY-MM-DD format',
      );
    }

    if (parsed.getTime() > Date.now()) {
      throw new BadRequestException('birthDate cannot be in the future');
    }

    const age = calculateAge(birthDate);
    if (age === null || age < MINIMUM_AGE) {
      throw new BadRequestException(
        `The user must be at least ${MINIMUM_AGE} years old`,
      );
    }
  }

  private async assertCityExists(
    cityId: string,
    manager: EntityManager,
  ): Promise<void> {
    const city = await manager
      .getRepository(City)
      .findOneBy({ id: cityId, isActive: true });

    if (!city) {
      throw new BadRequestException(
        'cityId does not reference an active city',
      );
    }
  }

  private async assertOwnProfilePhoto(
    photoAssetId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const asset = await manager
      .getRepository(MediaAsset)
      .findOneBy({ id: photoAssetId });

    if (!asset || asset.deletedAt) {
      throw new BadRequestException('photoAssetId does not reference an asset');
    }

    if (asset.ownerUserId !== userId) {
      throw new BadRequestException(
        'The photo asset must belong to the current user',
      );
    }

    if (asset.kind !== 'profile_photo') {
      throw new BadRequestException(
        'The photo asset must have kind profile_photo',
      );
    }

    if (asset.moderationStatus === 'rejected') {
      throw new BadRequestException(
        'The photo asset was rejected by moderation',
      );
    }
  }

  /**
   * Keeps the "preferred zones belong to the profile city" invariant when the
   * city changes. If the city is cleared, every preferred zone is removed.
   */
  private async prunePreferredZonesOutsideCity(
    userId: string,
    cityId: string | null,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(UserPreferredZone);

    if (!cityId) {
      await repository.delete({ userId });
      return;
    }

    await repository
      .createQueryBuilder()
      .delete()
      .from(UserPreferredZone)
      .where('user_id = :userId', { userId })
      .andWhere(
        'zone_id NOT IN (SELECT id FROM zones WHERE city_id = :cityId)',
        { cityId },
      )
      .execute();
  }

  private async assertProfileExists(
    userId: string,
    manager: EntityManager,
  ): Promise<Profile> {
    const profile = await manager
      .getRepository(Profile)
      .findOneBy({ userId });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  private async loadCompletenessInput(
    userId: string,
    manager: EntityManager,
  ): Promise<ProfileCompletenessInput> {
    const [
      profile,
      lifestyle,
      roommatePreferences,
      housingPreferences,
      preferredZonesCount,
      preferredAmenitiesCount,
    ] = await Promise.all([
      manager.getRepository(Profile).findOneBy({ userId }),
      manager.getRepository(LifestyleProfile).findOneBy({ userId }),
      manager.getRepository(RoommatePreference).findOneBy({ userId }),
      manager.getRepository(HousingPreference).findOneBy({ userId }),
      manager.getRepository(UserPreferredZone).countBy({ userId }),
      manager.getRepository(HousingPreferenceAmenity).countBy({ userId }),
    ]);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      profile,
      lifestyle,
      roommatePreferences,
      housingPreferences,
      preferredZonesCount,
      preferredAmenitiesCount,
    };
  }

  private async recalculateCompleteness(
    userId: string,
    manager: EntityManager,
  ): Promise<number> {
    const input = await this.loadCompletenessInput(userId, manager);
    const result = this.completenessService.calculate(input);

    await manager
      .getRepository(Profile)
      .update({ userId }, { completenessPct: result.completenessPct });

    return result.completenessPct;
  }

  private async loadCity(cityId: string | null): Promise<City | null> {
    if (!cityId) {
      return null;
    }

    return this.dataSource.getRepository(City).findOneBy({ id: cityId });
  }

  private async loadZones(
    links: UserPreferredZone[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Zone[]> {
    if (links.length === 0) {
      return [];
    }

    return manager.getRepository(Zone).find({
      where: { id: In(links.map((link) => link.zoneId)) },
      order: { name: 'ASC' },
    });
  }

  private async loadAmenities(
    links: HousingPreferenceAmenity[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Amenity[]> {
    if (links.length === 0) {
      return [];
    }

    return manager.getRepository(Amenity).find({
      where: { id: In(links.map((link) => link.amenityId)) },
      order: { name: 'ASC' },
    });
  }

  private toMoney(value: number | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value.toFixed(2);
  }

}
