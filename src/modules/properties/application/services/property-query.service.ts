import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, type SelectQueryBuilder } from 'typeorm';
import { pointTransformer } from '../../../../common/database/point.transformer.js';
import { User } from '../../../accounts/domain/entities/index.js';
import { Amenity, City, Zone } from '../../../catalog/domain/entities/index.js';
import {
  Conversation,
  ConversationParticipant,
} from '../../../chat/domain/entities/index.js';
import { Profile } from '../../../profiles/domain/entities/index.js';
import {
  FavoriteProperty,
  Property,
  PropertyAmenity,
  type PropertyStatus,
  type PropertyType,
} from '../../domain/entities/index.js';
import { decodeCursor, encodeCursor } from '../cursor.js';
import type { ContactsQueryDto } from '../dto/contacts-query.dto.js';
import type { MyPropertiesQueryDto } from '../dto/my-properties-query.dto.js';
import type { PaginationQueryDto } from '../dto/pagination-query.dto.js';
import {
  FavoritePropertyDto,
  FavoritePropertyListResponseDto,
  PropertyAmenityDto,
  PropertyAmenitiesResponseDto,
  PropertyContactDto,
  PropertyContactListResponseDto,
  PropertyDetailDto,
  PropertyListResponseDto,
  PropertyMapItemDto,
  PropertyMapResponseDto,
  PropertySummaryDto,
} from '../dto/property-response.dto.js';
import type { PointDto } from '../dto/point.dto.js';
import type { SearchPropertiesQueryDto } from '../dto/search-properties-query.dto.js';
import type { PropertySort } from '../property-status.js';

interface PropertyAmenityRow {
  id: string;
  code: string;
  name: string;
}

interface PropertyRow {
  id: string;
  title: string | null;
  description: string | null;
  propertyType: PropertyType | null;
  cityId: string | null;
  cityName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  rentAmount: string | null;
  depositAmount: string | null;
  additionalCostsEstimate: string | null;
  currency: string;
  availableFrom: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: boolean;
  petsAllowed: boolean;
  smokersAllowed: boolean;
  requiresGuarantor: boolean;
  requiresIncomeProof: boolean;
  minContractMonths: number | null;
  status: PropertyStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  locationPublic: string | null;
  amenities: PropertyAmenityRow[] | string | null;
  houseRules?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: Date | null;
  expiresAt?: Date | null;
  addressExact?: string | null;
  locationExact?: string | null;
  favoritedAt?: Date;
}

interface PropertyMapRow {
  id: string;
  title: string | null;
  propertyType: PropertyType | null;
  rentAmount: string | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  cityId: string | null;
  zoneId: string | null;
  locationPublic: string;
  createdAt: Date;
}

interface PropertyContactRow {
  conversationId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  photoAssetId: string | null;
  contactPhone: string | null;
  conversationStatus: 'active' | 'closed';
  lastMessageAt: Date | null;
  createdAt: Date;
}

export interface PropertyOwnerSnapshot {
  id: string;
  status: string;
  identityStatus: string;
  landlordEnabledAt: Date | null;
}

export interface ZoneSnapshot {
  id: string;
  cityId: string;
  isActive: boolean;
}

export interface CitySnapshot {
  id: string;
  isActive: boolean;
}

export interface AmenitySnapshot {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

@Injectable()
export class PropertyQueryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async search(
    filters: SearchPropertiesQueryDto,
  ): Promise<PropertyListResponseDto> {
    const limit = filters.limit ?? 20;
    const query = this.createSummaryQuery();

    this.applyPublicFilters(query, filters);
    this.applySearchSort(query, filters.sort ?? 'newest', filters.cursor);
    query.limit(limit + 1);

    const rows = await query.getRawMany<PropertyRow>();
    const page = rows.slice(0, limit);
    const nextCursor = this.nextSearchCursor(
      rows,
      limit,
      filters.sort ?? 'newest',
    );

    return {
      data: page.map((row) => this.toSummaryDto(row)),
      nextCursor,
    };
  }

  async map(
    filters: SearchPropertiesQueryDto,
  ): Promise<PropertyMapResponseDto> {
    const limit = filters.limit ?? 20;
    const query = this.dataSource.createQueryBuilder(Property, 'p');

    query
      .select('p.id', 'id')
      .addSelect('p.title', 'title')
      .addSelect('p.propertyType', 'propertyType')
      .addSelect('p.rentAmount', 'rentAmount')
      .addSelect('p.currency', 'currency')
      .addSelect('p.bedrooms', 'bedrooms')
      .addSelect('p.bathrooms', 'bathrooms')
      .addSelect('p.cityId', 'cityId')
      .addSelect('p.zoneId', 'zoneId')
      .addSelect('p.locationPublic', 'locationPublic')
      .addSelect('p.createdAt', 'createdAt');

    this.applyPublicFilters(query, filters);
    query.andWhere('p.locationPublic IS NOT NULL');
    this.applySearchSort(query, filters.sort ?? 'newest', filters.cursor);
    query.limit(limit + 1);

    const rows = await query.getRawMany<PropertyMapRow>();
    const page = rows.slice(0, limit);
    const nextCursor = this.nextSearchCursor(
      rows,
      limit,
      filters.sort ?? 'newest',
    );

    return {
      data: page.map((row) => this.toMapDto(row)),
      nextCursor,
    };
  }

  async findLandlordProperties(
    landlordId: string,
    filters: MyPropertiesQueryDto,
  ): Promise<PropertyListResponseDto> {
    const limit = filters.limit ?? 20;
    const query = this.createSummaryQuery().where(
      'p.landlordId = :landlordId',
      { landlordId },
    );

    if (filters.status) {
      query.andWhere('p.status = :status', { status: filters.status });
      if (filters.status !== 'deleted') {
        query.andWhere('p.deletedAt IS NULL');
      }
    } else {
      query
        .andWhere('p.status <> :deletedStatus', {
          deletedStatus: 'deleted',
        })
        .andWhere('p.deletedAt IS NULL');
    }

    this.applyNewestSort(query, filters.cursor);
    query.limit(limit + 1);

    const rows = await query.getRawMany<PropertyRow>();
    const page = rows.slice(0, limit);
    const nextCursor = this.nextNewestCursor(rows, limit);

    return {
      data: page.map((row) => this.toSummaryDto(row)),
      nextCursor,
    };
  }

  async findFavorites(
    userId: string,
    filters: PaginationQueryDto,
  ): Promise<FavoritePropertyListResponseDto> {
    const limit = filters.limit ?? 20;
    const query = this.createSummaryQuery()
      .innerJoin(FavoriteProperty, 'fp', 'fp.propertyId = p.id')
      .addSelect('fp.createdAt', 'favoritedAt')
      .where('fp.userId = :userId', { userId })
      .andWhere('p.deletedAt IS NULL')
      .andWhere('p.status <> :deletedStatus', {
        deletedStatus: 'deleted',
      });

    query.orderBy('fp.createdAt', 'DESC').addOrderBy('fp.propertyId', 'DESC');

    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      const favoritedAt = this.cursorTimestamp(cursor.c);
      const propertyId = this.cursorUuid(cursor.i);
      query.andWhere(
        '(fp.createdAt < :cursorCreatedAt OR (fp.createdAt = :cursorCreatedAt AND fp.propertyId < :cursorPropertyId))',
        { cursorCreatedAt: favoritedAt, cursorPropertyId: propertyId },
      );
    }

    query.limit(limit + 1);

    const rows = await query.getRawMany<PropertyRow>();
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeCursor({
            c: this.toCursorTimestamp(page[page.length - 1].favoritedAt),
            i: page[page.length - 1].id,
          })
        : null;

    return {
      data: page.map((row) => this.toFavoriteDto(row)),
      nextCursor,
    };
  }

  async findContacts(
    propertyId: string,
    filters: ContactsQueryDto,
  ): Promise<PropertyContactListResponseDto> {
    const limit = filters.limit ?? 20;
    const query = this.dataSource
      .createQueryBuilder(Conversation, 'cv')
      .innerJoin(User, 'u', 'u.id = cv.initiatorUserId')
      .innerJoin(
        ConversationParticipant,
        'cp',
        'cp.conversationId = cv.id AND cp.userId = cv.initiatorUserId',
      )
      .leftJoin(Profile, 'pr', 'pr.userId = u.id')
      .select('cv.id', 'conversationId')
      .addSelect('u.id', 'userId')
      .addSelect('pr.firstName', 'firstName')
      .addSelect('pr.lastName', 'lastName')
      .addSelect('pr.photoAssetId', 'photoAssetId')
      .addSelect('pr.contactPhone', 'contactPhone')
      .addSelect('cv.status', 'conversationStatus')
      .addSelect('cv.lastMessageAt', 'lastMessageAt')
      .addSelect('cv.createdAt', 'createdAt')
      .where('cv.propertyId = :propertyId', { propertyId })
      .andWhere("cv.kind = 'rental'")
      .orderBy('cv.createdAt', 'DESC')
      .addOrderBy('cv.id', 'DESC');

    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      const createdAt = this.cursorTimestamp(cursor.c);
      const conversationId = this.cursorUuid(cursor.i);
      query.andWhere(
        '(cv.createdAt < :cursorCreatedAt OR (cv.createdAt = :cursorCreatedAt AND cv.id < :cursorConversationId))',
        { cursorCreatedAt: createdAt, cursorConversationId: conversationId },
      );
    }

    query.limit(limit + 1);

    const rows = await query.getRawMany<PropertyContactRow>();
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeCursor({
            c: this.toCursorTimestamp(page[page.length - 1].createdAt),
            i: page[page.length - 1].conversationId,
          })
        : null;

    return {
      data: page.map((row) => this.toContactDto(row)),
      nextCursor,
    };
  }

  async findDetail(
    propertyId: string,
    includeExactLocation: boolean,
  ): Promise<PropertyDetailDto | null> {
    const query = this.createSummaryQuery().where('p.id = :propertyId', {
      propertyId,
    });

    query
      .addSelect('p.houseRules', 'houseRules')
      .addSelect('p.rejectionReason', 'rejectionReason')
      .addSelect('p.reviewedAt', 'reviewedAt')
      .addSelect('p.expiresAt', 'expiresAt');

    if (includeExactLocation) {
      query
        .addSelect('p.addressExact', 'addressExact')
        .addSelect('p.locationExact', 'locationExact');
    }

    const row = await query.getRawOne<PropertyRow>();
    return row ? this.toDetailDto(row, includeExactLocation) : null;
  }

  async getAmenitiesForProperty(
    propertyId: string,
  ): Promise<PropertyAmenitiesResponseDto> {
    const rows = await this.dataSource
      .createQueryBuilder(PropertyAmenity, 'pa')
      .innerJoin(Amenity, 'a', 'a.id = pa.amenityId')
      .select('a.id', 'id')
      .addSelect('a.code', 'code')
      .addSelect('a.name', 'name')
      .where('pa.propertyId = :propertyId', { propertyId })
      .orderBy('a.name', 'ASC')
      .getRawMany<PropertyAmenityRow>();

    return {
      data: rows.map((row) => this.toAmenityDto(row)),
    };
  }

  async getUserSnapshot(userId: string): Promise<PropertyOwnerSnapshot | null> {
    const user = await this.dataSource
      .createQueryBuilder(User, 'u')
      .select(['u.id', 'u.status', 'u.identityStatus', 'u.landlordEnabledAt'])
      .where('u.id = :userId', { userId })
      .getOne();

    return user
      ? {
          id: user.id,
          status: user.status,
          identityStatus: user.identityStatus,
          landlordEnabledAt: user.landlordEnabledAt,
        }
      : null;
  }

  async getCity(cityId: string): Promise<CitySnapshot | null> {
    const city = await this.dataSource
      .createQueryBuilder(City, 'c')
      .select(['c.id', 'c.isActive'])
      .where('c.id = :cityId', { cityId })
      .getOne();

    return city ? { id: city.id, isActive: city.isActive } : null;
  }

  async getZone(zoneId: string): Promise<ZoneSnapshot | null> {
    const zone = await this.dataSource
      .createQueryBuilder(Zone, 'z')
      .select(['z.id', 'z.cityId', 'z.isActive'])
      .where('z.id = :zoneId', { zoneId })
      .getOne();

    return zone
      ? { id: zone.id, cityId: zone.cityId, isActive: zone.isActive }
      : null;
  }

  async getAmenitiesByIds(ids: string[]): Promise<AmenitySnapshot[]> {
    if (ids.length === 0) {
      return [];
    }

    const amenities = await this.dataSource
      .createQueryBuilder(Amenity, 'a')
      .select(['a.id', 'a.code', 'a.name', 'a.isActive'])
      .where('a.id IN (:...ids)', { ids })
      .getMany();

    return amenities.map((amenity) => ({
      id: amenity.id,
      code: amenity.code,
      name: amenity.name,
      isActive: amenity.isActive,
    }));
  }

  async isRentalInitiator(
    propertyId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.dataSource
      .createQueryBuilder(Conversation, 'cv')
      .where('cv.propertyId = :propertyId', { propertyId })
      .andWhere('cv.initiatorUserId = :userId', { userId })
      .andWhere("cv.kind = 'rental'")
      .andWhere("cv.status = 'active'")
      .getCount();

    return count > 0;
  }

  private createSummaryQuery(): SelectQueryBuilder<Property> {
    const query = this.dataSource
      .createQueryBuilder(Property, 'p')
      .leftJoin(City, 'c', 'c.id = p.cityId')
      .leftJoin(Zone, 'z', 'z.id = p.zoneId');

    query
      .select('p.id', 'id')
      .addSelect('p.title', 'title')
      .addSelect('p.description', 'description')
      .addSelect('p.propertyType', 'propertyType')
      .addSelect('p.cityId', 'cityId')
      .addSelect('c.name', 'cityName')
      .addSelect('p.zoneId', 'zoneId')
      .addSelect('z.name', 'zoneName')
      .addSelect('p.rentAmount', 'rentAmount')
      .addSelect('p.depositAmount', 'depositAmount')
      .addSelect('p.additionalCostsEstimate', 'additionalCostsEstimate')
      .addSelect('p.currency', 'currency')
      .addSelect('p.availableFrom', 'availableFrom')
      .addSelect('p.bedrooms', 'bedrooms')
      .addSelect('p.bathrooms', 'bathrooms')
      .addSelect('p.furnished', 'furnished')
      .addSelect('p.petsAllowed', 'petsAllowed')
      .addSelect('p.smokersAllowed', 'smokersAllowed')
      .addSelect('p.requiresGuarantor', 'requiresGuarantor')
      .addSelect('p.requiresIncomeProof', 'requiresIncomeProof')
      .addSelect('p.minContractMonths', 'minContractMonths')
      .addSelect('p.status', 'status')
      .addSelect('p.publishedAt', 'publishedAt')
      .addSelect('p.createdAt', 'createdAt')
      .addSelect('p.updatedAt', 'updatedAt')
      .addSelect('p.locationPublic', 'locationPublic')
      .addSelect(
        `COALESCE((
          SELECT json_agg(json_build_object('id', a.id, 'code', a.code, 'name', a.name) ORDER BY a.name)
          FROM property_amenities pa
          INNER JOIN amenities a ON a.id = pa.amenity_id
          WHERE pa.property_id = p.id
        ), '[]'::json)`,
        'amenities',
      );

    return query;
  }

  private applyPublicFilters(
    query: SelectQueryBuilder<Property>,
    filters: SearchPropertiesQueryDto,
  ): void {
    query
      .where('p.status = :activeStatus', { activeStatus: 'active' })
      .andWhere('p.deletedAt IS NULL');

    if (filters.cityId) {
      query.andWhere('p.cityId = :cityId', { cityId: filters.cityId });
    }

    if (filters.zoneIds?.length) {
      query.andWhere('p.zoneId IN (:...zoneIds)', {
        zoneIds: filters.zoneIds,
      });
    }

    if (filters.minPrice !== undefined) {
      query.andWhere('p.rentAmount >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }

    if (filters.maxPrice !== undefined) {
      query.andWhere('p.rentAmount <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }

    if (filters.type) {
      query.andWhere('p.propertyType = :propertyType', {
        propertyType: filters.type,
      });
    }

    if (filters.bedrooms !== undefined) {
      query.andWhere('p.bedrooms = :bedrooms', {
        bedrooms: filters.bedrooms,
      });
    }

    if (filters.bathrooms !== undefined) {
      query.andWhere('p.bathrooms = :bathrooms', {
        bathrooms: filters.bathrooms,
      });
    }

    if (filters.furnished !== undefined) {
      query.andWhere('p.furnished = :furnished', {
        furnished: filters.furnished,
      });
    }

    if (filters.availableFrom) {
      query.andWhere('p.availableFrom >= :availableFrom', {
        availableFrom: filters.availableFrom,
      });
    }

    if (filters.amenityIds?.length) {
      const amenityIds = [...new Set(filters.amenityIds)];
      query.andWhere(
        `p.id IN (
          SELECT pa_filter.property_id
          FROM property_amenities pa_filter
          WHERE pa_filter.amenity_id IN (:...amenityIds)
          GROUP BY pa_filter.property_id
          HAVING COUNT(DISTINCT pa_filter.amenity_id) = :amenityCount
        )`,
        { amenityIds, amenityCount: amenityIds.length },
      );
    }
  }

  private applySearchSort(
    query: SelectQueryBuilder<Property>,
    sort: PropertySort,
    rawCursor: string | undefined,
  ): void {
    const cursor = decodeCursor(rawCursor);

    if (sort === 'newest') {
      this.applyNewestSort(query, rawCursor);
      return;
    }

    if (cursor && cursor.s !== sort) {
      throw new BadRequestException(
        'Pagination cursor does not match the requested sort',
      );
    }

    if (sort === 'price_asc') {
      query.orderBy('p.rentAmount', 'ASC').addOrderBy('p.id', 'ASC');

      if (cursor) {
        const price = this.cursorString(cursor.p);
        const id = this.cursorUuid(cursor.i);
        query.andWhere(
          '(p.rentAmount > :cursorPrice OR (p.rentAmount = :cursorPrice AND p.id > :cursorId))',
          { cursorPrice: price, cursorId: id },
        );
      }
      return;
    }

    query.orderBy('p.rentAmount', 'DESC').addOrderBy('p.id', 'DESC');

    if (cursor) {
      const price = this.cursorString(cursor.p);
      const id = this.cursorUuid(cursor.i);
      query.andWhere(
        '(p.rentAmount < :cursorPrice OR (p.rentAmount = :cursorPrice AND p.id < :cursorId))',
        { cursorPrice: price, cursorId: id },
      );
    }
  }

  private applyNewestSort(
    query: SelectQueryBuilder<Property>,
    rawCursor: string | undefined,
  ): void {
    query.orderBy('p.createdAt', 'DESC').addOrderBy('p.id', 'DESC');

    const cursor = decodeCursor(rawCursor);
    if (!cursor) {
      return;
    }

    if (cursor.s !== 'newest') {
      throw new BadRequestException(
        'Pagination cursor does not match the requested sort',
      );
    }

    const createdAt = this.cursorTimestamp(cursor.c);
    const id = this.cursorUuid(cursor.i);
    query.andWhere(
      '(p.createdAt < :cursorCreatedAt OR (p.createdAt = :cursorCreatedAt AND p.id < :cursorId))',
      { cursorCreatedAt: createdAt, cursorId: id },
    );
  }

  private nextSearchCursor(
    rows: Array<{ id: string; createdAt: Date; rentAmount: string | null }>,
    limit: number,
    sort: PropertySort,
  ): string | null {
    if (rows.length <= limit) {
      return null;
    }

    const last = rows[limit - 1];
    return sort === 'newest'
      ? encodeCursor({
          s: sort,
          c: this.toCursorTimestamp(last.createdAt),
          i: last.id,
        })
      : encodeCursor({ s: sort, p: last.rentAmount, i: last.id });
  }

  private nextNewestCursor(
    rows: Array<{ id: string; createdAt: Date }>,
    limit: number,
  ): string | null {
    if (rows.length <= limit) {
      return null;
    }

    const last = rows[limit - 1];
    return encodeCursor({
      s: 'newest',
      c: this.toCursorTimestamp(last.createdAt),
      i: last.id,
    });
  }

  private toSummaryDto(row: PropertyRow): PropertySummaryDto {
    const dto = new PropertySummaryDto();
    dto.id = row.id;
    dto.title = row.title;
    dto.description = row.description;
    dto.propertyType = row.propertyType;
    dto.cityId = row.cityId;
    dto.cityName = row.cityName;
    dto.zoneId = row.zoneId;
    dto.zoneName = row.zoneName;
    dto.rentAmount = row.rentAmount;
    dto.depositAmount = row.depositAmount;
    dto.additionalCostsEstimate = row.additionalCostsEstimate;
    dto.currency = row.currency;
    dto.availableFrom = row.availableFrom;
    dto.bedrooms = row.bedrooms;
    dto.bathrooms = row.bathrooms;
    dto.furnished = row.furnished;
    dto.petsAllowed = row.petsAllowed;
    dto.smokersAllowed = row.smokersAllowed;
    dto.requiresGuarantor = row.requiresGuarantor;
    dto.requiresIncomeProof = row.requiresIncomeProof;
    dto.minContractMonths = row.minContractMonths;
    dto.status = row.status;
    dto.publishedAt = this.toTimestamp(row.publishedAt);
    dto.createdAt = this.toTimestamp(row.createdAt) ?? '';
    dto.updatedAt = this.toTimestamp(row.updatedAt) ?? '';
    dto.locationPublic = this.toPointDto(row.locationPublic);
    dto.amenities = this.parseAmenities(row.amenities).map((amenity) =>
      this.toAmenityDto(amenity),
    );
    return dto;
  }

  private toDetailDto(
    row: PropertyRow,
    includeExactLocation: boolean,
  ): PropertyDetailDto {
    const dto = new PropertyDetailDto();
    Object.assign(dto, this.toSummaryDto(row));
    dto.houseRules = row.houseRules ?? null;
    dto.rejectionReason = row.rejectionReason ?? null;
    dto.reviewedAt = this.toTimestamp(row.reviewedAt);
    dto.expiresAt = this.toTimestamp(row.expiresAt);

    if (includeExactLocation) {
      dto.addressExact = row.addressExact ?? null;
      dto.locationExact = this.toPointDto(row.locationExact);
    }

    return dto;
  }

  private toMapDto(row: PropertyMapRow): PropertyMapItemDto {
    const dto = new PropertyMapItemDto();
    dto.id = row.id;
    dto.title = row.title;
    dto.propertyType = row.propertyType;
    dto.rentAmount = row.rentAmount;
    dto.currency = row.currency;
    dto.bedrooms = row.bedrooms;
    dto.bathrooms = row.bathrooms;
    dto.cityId = row.cityId;
    dto.zoneId = row.zoneId;

    const location = this.toPointDto(row.locationPublic);
    if (!location) {
      throw new BadRequestException('Property is missing a public location');
    }
    dto.locationPublic = location;

    return dto;
  }

  private toFavoriteDto(row: PropertyRow): FavoritePropertyDto {
    const dto = new FavoritePropertyDto();
    Object.assign(dto, this.toSummaryDto(row));
    dto.favoritedAt =
      this.toTimestamp(row.favoritedAt) ?? new Date(0).toISOString();
    dto.isAvailable = row.status === 'active';
    return dto;
  }

  private toContactDto(row: PropertyContactRow): PropertyContactDto {
    const dto = new PropertyContactDto();
    dto.conversationId = row.conversationId;
    dto.userId = row.userId;
    dto.firstName = row.firstName;
    dto.lastName = row.lastName;
    dto.photoAssetId = row.photoAssetId;
    dto.contactPhone = row.contactPhone;
    dto.conversationStatus = row.conversationStatus;
    dto.lastMessageAt = this.toTimestamp(row.lastMessageAt);
    dto.createdAt = this.toTimestamp(row.createdAt) ?? '';
    return dto;
  }

  private toAmenityDto(row: PropertyAmenityRow): PropertyAmenityDto {
    const dto = new PropertyAmenityDto();
    dto.id = row.id;
    dto.code = row.code;
    dto.name = row.name;
    return dto;
  }

  private parseAmenities(
    value: PropertyAmenityRow[] | string | null,
  ): PropertyAmenityRow[] {
    if (!value) {
      return [];
    }

    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as PropertyAmenityRow[]) : [];
      } catch {
        return [];
      }
    }

    return value;
  }

  private toPointDto(value: string | null | undefined): PointDto | null {
    if (!value) {
      return null;
    }

    const point = pointTransformer.from(value);
    return point
      ? { latitude: point.latitude, longitude: point.longitude }
      : null;
  }

  private toTimestamp(value: Date | string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toCursorTimestamp(value: Date | string | null | undefined): string {
    const timestamp = this.toTimestamp(value);
    if (!timestamp) {
      throw new BadRequestException('Invalid pagination cursor');
    }
    return timestamp;
  }

  private cursorString(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException('Invalid pagination cursor');
    }
    return value;
  }

  private cursorTimestamp(value: unknown): string {
    const raw = this.cursorString(value);
    const timestamp = new Date(raw);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException('Invalid pagination cursor');
    }
    return timestamp.toISOString();
  }

  private cursorUuid(value: unknown): string {
    const id = this.cursorString(value);
    if (!isUUID(id, 'all')) {
      throw new BadRequestException('Invalid pagination cursor');
    }
    return id;
  }
}
