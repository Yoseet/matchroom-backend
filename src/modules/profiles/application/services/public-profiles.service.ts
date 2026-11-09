import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, In } from 'typeorm';
import { User } from '../../../accounts/domain/entities/index.js';
import {
  Amenity,
  City,
  Zone,
} from '../../../catalog/domain/entities/index.js';
import { Match } from '../../../matching/domain/entities/index.js';
import { MediaAsset } from '../../../media/domain/entities/index.js';
import {
  PrivacySetting,
  type ProfileVisibility,
} from '../../../privacy/domain/entities/index.js';
import { UserBlock } from '../../../safety/domain/entities/index.js';
import {
  HousingPreference,
  HousingPreferenceAmenity,
  LifestyleProfile,
  Profile,
  RoommatePreference,
  UserPreferredZone,
} from '../../domain/entities/index.js';
import { ListProfilesQueryDto } from '../dto/list-profiles-query.dto.js';
import {
  ListProfilesResponseDto,
  PublicProfileResponseDto,
} from '../dto/public-profile-response.dto.js';
import { calculateAge } from './profile-age.util.js';
import {
  toAmenitySummary,
  toCitySummary,
  toHousingPreferencesResponse,
  toLifestyleResponse,
  toRoommatePreferencesResponse,
  toZoneSummary,
} from './profile-response.mapper.js';

const MINIMUM_DISCOVERY_COMPLETENESS = 70;

interface EffectivePrivacy {
  profileVisibility: ProfileVisibility;
  showExactAge: boolean;
  showOccupation: boolean;
  showPhoto: boolean;
  appearInSearch: boolean;
  showHousingPreferences: boolean;
}

interface Cursor {
  completenessPct: number;
  userId: string;
}

const DEFAULT_PRIVACY: EffectivePrivacy = {
  profileVisibility: 'everyone',
  showExactAge: true,
  showOccupation: true,
  showPhoto: true,
  appearInSearch: true,
  showHousingPreferences: true,
};

function encodeCursor(profile: Profile): string {
  return Buffer.from(
    `${profile.completenessPct}:${profile.userId}`,
    'utf8',
  ).toString('base64url');
}

function decodeCursor(value: string): Cursor {
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) {
      throw new Error('missing separator');
    }

    const completenessPct = Number(decoded.slice(0, separator));
    const userId = decoded.slice(separator + 1);

    if (
      !Number.isInteger(completenessPct) ||
      completenessPct < 0 ||
      completenessPct > 100 ||
      !isUUID(userId)
    ) {
      throw new Error('invalid cursor payload');
    }

    return { completenessPct, userId };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

/**
 * Public profile projection and discovery.
 *
 * Both direct reads and the discovery list use the same projection so privacy
 * and `looking_for` rules cannot diverge between endpoints.
 */
@Injectable()
export class PublicProfilesService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getPublicProfile(
    requesterId: string,
    targetUserId: string,
  ): Promise<PublicProfileResponseDto> {
    const requester = await this.getActiveUser(requesterId);

    const target = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: targetUserId });

    if (!target || target.status !== 'active') {
      throw new NotFoundException('Profile not found');
    }

    const profile = await this.dataSource
      .getRepository(Profile)
      .findOneBy({ userId: targetUserId });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (requesterId !== targetUserId) {
      const privacy = await this.dataSource
        .getRepository(PrivacySetting)
        .findOneBy({ userId: targetUserId });

      const effectivePrivacy = this.resolvePrivacy(privacy);

      if (!effectivePrivacy.appearInSearch) {
        throw new NotFoundException('Profile not found');
      }

      await this.assertVisible(requester, targetUserId, effectivePrivacy);
    }

    const [projection] = await this.buildPublicProfiles([profile]);
    if (!projection) {
      throw new NotFoundException('Profile not found');
    }

    return projection;
  }

  async listProfiles(
    requesterId: string,
    query: ListProfilesQueryDto,
  ): Promise<ListProfilesResponseDto> {
    const requester = await this.getActiveUser(requesterId);

    const qb = this.dataSource
      .getRepository(Profile)
      .createQueryBuilder('p')
      .innerJoin(
        User,
        'u',
        'u.id = p.user_id AND u.status = :activeStatus',
        { activeStatus: 'active' },
      )
      .leftJoin(PrivacySetting, 'ps', 'ps.user_id = p.user_id')
      .where('p.user_id <> :requesterId', { requesterId })
      .andWhere('p.completeness_pct >= :minimumCompleteness', {
        minimumCompleteness: MINIMUM_DISCOVERY_COMPLETENESS,
      })
      .andWhere('COALESCE(ps.appear_in_search, true) = true');

    const visibility = `COALESCE(ps.profile_visibility, 'everyone')`;
    const visibilityConditions = [`${visibility} = 'everyone'`];

    if (requester.identityStatus === 'verified') {
      visibilityConditions.push(`${visibility} = 'verified_only'`);
    }

    visibilityConditions.push(`(
      ${visibility} = 'matches_only'
      AND EXISTS (
        SELECT 1
        FROM matches m
        WHERE m.status = 'active'
          AND (
            (m.user_a_id = :requesterId AND m.user_b_id = p.user_id)
            OR (m.user_b_id = :requesterId AND m.user_a_id = p.user_id)
          )
      )
    )`);

    qb.andWhere(`(${visibilityConditions.join(' OR ')})`);

    qb.andWhere(`NOT EXISTS (
      SELECT 1
      FROM user_blocks b
      WHERE (b.blocker_id = :requesterId AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = :requesterId)
    )`);

    qb.andWhere(`NOT EXISTS (
      SELECT 1
      FROM user_interests ui
      WHERE ui.from_user_id = :requesterId
        AND ui.to_user_id = p.user_id
        AND ui.action = 'dismissed'
    )`);

    if (query.lookingFor === 'roommate') {
      qb.andWhere(`p.looking_for IN ('roommate','both')`);
    } else if (query.lookingFor === 'housing') {
      qb.andWhere(`p.looking_for IN ('housing','both')`);
    }

    if (query.cityId) {
      qb.andWhere('p.city_id = :cityId', { cityId: query.cityId });
    }

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        `(p.completeness_pct < :cursorCompleteness
          OR (p.completeness_pct = :cursorCompleteness
              AND p.user_id > :cursorUserId))`,
        {
          cursorCompleteness: cursor.completenessPct,
          cursorUserId: cursor.userId,
        },
      );
    }

    qb.orderBy('p.completeness_pct', 'DESC')
      .addOrderBy('p.user_id', 'ASC')
      .limit(query.limit + 1);

    const rows = await qb.getMany();
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;

    const data = await this.buildPublicProfiles(page);

    return {
      data,
      nextCursor:
        hasNextPage && page.length > 0
          ? encodeCursor(page[page.length - 1])
          : null,
    };
  }

  private async getActiveUser(userId: string): Promise<User> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: userId });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException(
        'The acting user is not an active account',
      );
    }

    return user;
  }

  private resolvePrivacy(
    privacy: PrivacySetting | null | undefined,
  ): EffectivePrivacy {
    if (!privacy) {
      return DEFAULT_PRIVACY;
    }

    return {
      profileVisibility: privacy.profileVisibility,
      showExactAge: privacy.showExactAge,
      showOccupation: privacy.showOccupation,
      showPhoto: privacy.showPhoto,
      appearInSearch: privacy.appearInSearch,
      showHousingPreferences: privacy.showHousingPreferences,
    };
  }

  private async assertVisible(
    requester: User,
    targetUserId: string,
    privacy: EffectivePrivacy,
  ): Promise<void> {
    if (
      privacy.profileVisibility === 'verified_only' &&
      requester.identityStatus !== 'verified'
    ) {
      throw new NotFoundException('Profile not found');
    }

    if (privacy.profileVisibility === 'matches_only') {
      const hasMatch = await this.hasActiveMatch(
        requester.id,
        targetUserId,
      );
      if (!hasMatch) {
        throw new NotFoundException('Profile not found');
      }
    }

    const blocked = await this.hasBlock(requester.id, targetUserId);
    if (blocked) {
      throw new NotFoundException('Profile not found');
    }
  }

  private async hasActiveMatch(
    requesterId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const count = await this.dataSource.getRepository(Match).count({
      where: [
        {
          userAId: requesterId,
          userBId: targetUserId,
          status: 'active',
        },
        {
          userAId: targetUserId,
          userBId: requesterId,
          status: 'active',
        },
      ],
    });

    return count > 0;
  }

  private async hasBlock(
    requesterId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const count = await this.dataSource.getRepository(UserBlock).count({
      where: [
        { blockerId: requesterId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: requesterId },
      ],
    });

    return count > 0;
  }

  private async buildPublicProfiles(
    profiles: Profile[],
  ): Promise<PublicProfileResponseDto[]> {
    if (profiles.length === 0) {
      return [];
    }

    const userIds = profiles.map((profile) => profile.userId);

    const [
      privacyRows,
      lifestyleRows,
      roommateRows,
      housingRows,
      zoneLinks,
      amenityLinks,
    ] = await Promise.all([
      this.dataSource
        .getRepository(PrivacySetting)
        .find({ where: { userId: In(userIds) } }),
      this.dataSource
        .getRepository(LifestyleProfile)
        .find({ where: { userId: In(userIds) } }),
      this.dataSource
        .getRepository(RoommatePreference)
        .find({ where: { userId: In(userIds) } }),
      this.dataSource
        .getRepository(HousingPreference)
        .find({ where: { userId: In(userIds) } }),
      this.dataSource
        .getRepository(UserPreferredZone)
        .find({ where: { userId: In(userIds) } }),
      this.dataSource
        .getRepository(HousingPreferenceAmenity)
        .find({ where: { userId: In(userIds) } }),
    ]);

    const cityIds = [
      ...new Set(
        profiles
          .map((profile) => profile.cityId)
          .filter((cityId): cityId is string => cityId !== null),
      ),
    ];
    const zoneIds = [...new Set(zoneLinks.map((link) => link.zoneId))];
    const amenityIds = [
      ...new Set(amenityLinks.map((link) => link.amenityId)),
    ];
    const photoAssetIds = [
      ...new Set(
        profiles
          .map((profile) => profile.photoAssetId)
          .filter((assetId): assetId is string => assetId !== null),
      ),
    ];

    const [cities, zones, amenities, approvedPhotos] = await Promise.all([
      this.findCities(cityIds),
      this.findZones(zoneIds),
      this.findAmenities(amenityIds),
      this.findApprovedPhotos(photoAssetIds),
    ]);

    const privacyByUser = new Map(
      privacyRows.map((row) => [row.userId, row]),
    );
    const lifestyleByUser = new Map(
      lifestyleRows.map((row) => [row.userId, row]),
    );
    const roommateByUser = new Map(
      roommateRows.map((row) => [row.userId, row]),
    );
    const housingByUser = new Map(
      housingRows.map((row) => [row.userId, row]),
    );
    const cityById = new Map(cities.map((city) => [city.id, city]));
    const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
    const amenityById = new Map(
      amenities.map((amenity) => [amenity.id, amenity]),
    );
    const approvedPhotoIds = new Set(
      approvedPhotos.map((asset) => asset.id),
    );

    const zonesByUser = new Map<string, Zone[]>();
    for (const link of zoneLinks) {
      const zone = zoneById.get(link.zoneId);
      if (!zone) {
        continue;
      }

      const list = zonesByUser.get(link.userId) ?? [];
      list.push(zone);
      zonesByUser.set(link.userId, list);
    }

    const amenitiesByUser = new Map<string, Amenity[]>();
    for (const link of amenityLinks) {
      const amenity = amenityById.get(link.amenityId);
      if (!amenity) {
        continue;
      }

      const list = amenitiesByUser.get(link.userId) ?? [];
      list.push(amenity);
      amenitiesByUser.set(link.userId, list);
    }

    return profiles.map((profile) => {
      const privacy = this.resolvePrivacy(
        privacyByUser.get(profile.userId),
      );
      const lifestyle = lifestyleByUser.get(profile.userId) ?? null;
      const roommate = roommateByUser.get(profile.userId) ?? null;
      const housing = housingByUser.get(profile.userId) ?? null;
      const city = profile.cityId
        ? cityById.get(profile.cityId) ?? null
        : null;

      const seeksRoommate =
        profile.lookingFor === 'roommate' ||
        profile.lookingFor === 'both';
      const seeksHousing =
        profile.lookingFor === 'housing' ||
        profile.lookingFor === 'both';
      const showsHousing =
        seeksHousing && privacy.showHousingPreferences;

      return {
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        age: privacy.showExactAge
          ? calculateAge(profile.birthDate)
          : null,
        gender: profile.gender,
        bio: profile.bio,
        occupation: privacy.showOccupation
          ? profile.occupation
          : null,
        photoAssetId:
          privacy.showPhoto &&
          profile.photoAssetId &&
          approvedPhotoIds.has(profile.photoAssetId)
            ? profile.photoAssetId
            : null,
        lookingFor: profile.lookingFor,
        city: city ? toCitySummary(city) : null,
        completenessPct: profile.completenessPct,
        lifestyle:
          seeksRoommate && lifestyle
            ? toLifestyleResponse(lifestyle)
            : null,
        roommatePreferences:
          seeksRoommate && roommate
            ? toRoommatePreferencesResponse(roommate)
            : null,
        housingPreferences:
          showsHousing && housing
            ? toHousingPreferencesResponse(housing)
            : null,
        preferredZones: (
          zonesByUser.get(profile.userId) ?? []
        ).map((zone) => toZoneSummary(zone)),
        preferredAmenities: showsHousing
          ? (amenitiesByUser.get(profile.userId) ?? []).map(
              (amenity) => toAmenitySummary(amenity),
            )
          : null,
      };
    });
  }

  private async findCities(cityIds: string[]): Promise<City[]> {
    if (cityIds.length === 0) {
      return [];
    }

    return this.dataSource
      .getRepository(City)
      .find({ where: { id: In(cityIds) } });
  }

  private async findZones(zoneIds: string[]): Promise<Zone[]> {
    if (zoneIds.length === 0) {
      return [];
    }

    return this.dataSource
      .getRepository(Zone)
      .find({ where: { id: In(zoneIds) }, order: { name: 'ASC' } });
  }

  private async findAmenities(amenityIds: string[]): Promise<Amenity[]> {
    if (amenityIds.length === 0) {
      return [];
    }

    return this.dataSource
      .getRepository(Amenity)
      .find({ where: { id: In(amenityIds) }, order: { name: 'ASC' } });
  }

  /**
   * Only approved media may appear on public surfaces.
   */
  private async findApprovedPhotos(assetIds: string[]): Promise<MediaAsset[]> {
    if (assetIds.length === 0) {
      return [];
    }

    const assets = await this.dataSource.getRepository(MediaAsset).find({
      where: { id: In(assetIds), moderationStatus: 'approved' },
    });

    return assets.filter((asset) => asset.deletedAt === null);
  }
}
