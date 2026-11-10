import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import type { GeoPoint } from '../../../../common/database/point.transformer.js';
import {
  FavoriteProperty,
  Property,
  PropertyAmenity,
  PropertyStatusHistory,
  type PropertyStatus,
} from '../../domain/entities/index.js';
import { approximatePublicLocation } from '../property-location.js';
import {
  assertCanSubmitReview,
  assertEditableStatus,
  assertLandlordStatusTransition,
  assertTransition,
} from '../property-status.js';
import type { ChangePropertyStatusDto } from '../dto/change-property-status.dto.js';
import type { ContactsQueryDto } from '../dto/contacts-query.dto.js';
import type { CreatePropertyDto } from '../dto/create-property.dto.js';
import type { MyPropertiesQueryDto } from '../dto/my-properties-query.dto.js';
import type { PaginationQueryDto } from '../dto/pagination-query.dto.js';
import type { PointDto } from '../dto/point.dto.js';
import type {
  FavoritePropertyListResponseDto,
  PropertyAmenitiesResponseDto,
  PropertyContactListResponseDto,
  PropertyDetailDto,
  PropertyListResponseDto,
  PropertyMapResponseDto,
} from '../dto/property-response.dto.js';
import type { SearchPropertiesQueryDto } from '../dto/search-properties-query.dto.js';
import type { UpdatePropertyAmenitiesDto } from '../dto/update-property-amenities.dto.js';
import type { UpdatePropertyDto } from '../dto/update-property.dto.js';
import { PropertyQueryService } from './property-query.service.js';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(FavoriteProperty)
    private readonly favoriteRepository: Repository<FavoriteProperty>,
    private readonly queryService: PropertyQueryService,
  ) {}

  search(filters: SearchPropertiesQueryDto): Promise<PropertyListResponseDto> {
    return this.queryService.search(filters);
  }

  map(filters: SearchPropertiesQueryDto): Promise<PropertyMapResponseDto> {
    return this.queryService.map(filters);
  }

  async findMine(
    userId: string,
    filters: MyPropertiesQueryDto,
  ): Promise<PropertyListResponseDto> {
    await this.assertActiveUser(userId);
    return this.queryService.findLandlordProperties(userId, filters);
  }

  async getDetail(
    propertyId: string,
    viewerUserId?: string,
  ): Promise<PropertyDetailDto> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (
      !property ||
      property.deletedAt !== null ||
      property.status === 'deleted'
    ) {
      throw new NotFoundException('Property not found');
    }

    const isOwner =
      viewerUserId !== undefined && property.landlordId === viewerUserId;

    if (property.status !== 'active' && !isOwner) {
      throw new NotFoundException('Property not found');
    }

    const includeExactLocation =
      isOwner ||
      (viewerUserId !== undefined &&
        (await this.queryService.isRentalInitiator(propertyId, viewerUserId)));

    const detail = await this.queryService.findDetail(
      propertyId,
      includeExactLocation,
    );

    if (!detail) {
      throw new NotFoundException('Property not found');
    }

    return detail;
  }

  async create(
    dto: CreatePropertyDto,
    userId: string,
  ): Promise<PropertyDetailDto> {
    await this.assertCanCreateProperty(userId);

    const catalog = await this.resolveCatalog(
      dto.cityId ?? null,
      dto.zoneId ?? null,
    );
    const exactLocation = this.toGeoPoint(dto.locationExact) ?? null;
    const publicLocation =
      dto.locationPublic !== undefined
        ? (this.toGeoPoint(dto.locationPublic) ?? null)
        : exactLocation
          ? approximatePublicLocation(exactLocation)
          : null;

    const property = this.propertyRepository.create({
      landlordId: userId,
      title: dto.title ?? null,
      description: dto.description ?? null,
      propertyType: dto.propertyType ?? null,
      cityId: catalog.cityId,
      zoneId: catalog.zoneId,
      addressExact: dto.addressExact ?? null,
      locationExact: exactLocation,
      locationPublic: publicLocation,
      rentAmount:
        dto.rentAmount !== undefined && dto.rentAmount !== null
          ? this.toMoney(dto.rentAmount)
          : null,
      depositAmount:
        dto.depositAmount !== undefined && dto.depositAmount !== null
          ? this.toMoney(dto.depositAmount)
          : null,
      additionalCostsEstimate:
        dto.additionalCostsEstimate !== undefined &&
        dto.additionalCostsEstimate !== null
          ? this.toMoney(dto.additionalCostsEstimate)
          : null,
      currency: dto.currency?.toUpperCase() ?? 'MXN',
      availableFrom: dto.availableFrom ?? null,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      furnished: dto.furnished ?? false,
      petsAllowed: dto.petsAllowed ?? false,
      smokersAllowed: dto.smokersAllowed ?? false,
      houseRules: dto.houseRules ?? null,
      requiresGuarantor: dto.requiresGuarantor ?? false,
      requiresIncomeProof: dto.requiresIncomeProof ?? false,
      minContractMonths: dto.minContractMonths ?? null,
      status: 'draft',
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const created = await manager.getRepository(Property).save(property);
      await this.recordStatusHistory(
        manager,
        created.id,
        userId,
        null,
        'draft',
      );
      return created;
    });

    return this.getDetail(saved.id, userId);
  }

  async update(
    propertyId: string,
    userId: string,
    dto: UpdatePropertyDto,
  ): Promise<PropertyDetailDto> {
    const property = await this.getOwnedProperty(propertyId, userId);
    assertEditableStatus(property.status);

    const updates: Partial<Property> = {};

    if (dto.title !== undefined) updates.title = dto.title ?? null;
    if (dto.description !== undefined) {
      updates.description = dto.description ?? null;
    }
    if (dto.propertyType !== undefined) {
      updates.propertyType = dto.propertyType;
    }
    if (dto.addressExact !== undefined) {
      updates.addressExact = dto.addressExact ?? null;
    }
    if (dto.rentAmount !== undefined) {
      updates.rentAmount =
        dto.rentAmount === null ? null : this.toMoney(dto.rentAmount);
    }
    if (dto.depositAmount !== undefined) {
      updates.depositAmount =
        dto.depositAmount === null ? null : this.toMoney(dto.depositAmount);
    }
    if (dto.additionalCostsEstimate !== undefined) {
      updates.additionalCostsEstimate =
        dto.additionalCostsEstimate === null
          ? null
          : this.toMoney(dto.additionalCostsEstimate);
    }
    if (dto.currency !== undefined) {
      updates.currency = dto.currency?.toUpperCase() ?? 'MXN';
    }
    if (dto.availableFrom !== undefined) {
      updates.availableFrom = dto.availableFrom ?? null;
    }
    if (dto.bedrooms !== undefined) {
      updates.bedrooms = dto.bedrooms ?? null;
    }
    if (dto.bathrooms !== undefined) {
      updates.bathrooms = dto.bathrooms ?? null;
    }
    if (dto.furnished !== undefined) {
      updates.furnished = dto.furnished ?? false;
    }
    if (dto.petsAllowed !== undefined) {
      updates.petsAllowed = dto.petsAllowed ?? false;
    }
    if (dto.smokersAllowed !== undefined) {
      updates.smokersAllowed = dto.smokersAllowed ?? false;
    }
    if (dto.houseRules !== undefined) {
      updates.houseRules = dto.houseRules ?? null;
    }
    if (dto.requiresGuarantor !== undefined) {
      updates.requiresGuarantor = dto.requiresGuarantor ?? false;
    }
    if (dto.requiresIncomeProof !== undefined) {
      updates.requiresIncomeProof = dto.requiresIncomeProof ?? false;
    }
    if (dto.minContractMonths !== undefined) {
      updates.minContractMonths = dto.minContractMonths ?? null;
    }

    if (dto.cityId !== undefined || dto.zoneId !== undefined) {
      let cityId = dto.cityId !== undefined ? dto.cityId : property.cityId;
      let zoneId = dto.zoneId !== undefined ? dto.zoneId : property.zoneId;

      if (dto.cityId === null && dto.zoneId === undefined) {
        zoneId = null;
      }
      if (dto.zoneId !== undefined && dto.cityId === undefined) {
        cityId = null;
      }

      const catalog = await this.resolveCatalog(cityId, zoneId);
      updates.cityId = catalog.cityId;
      updates.zoneId = catalog.zoneId;
    }

    if (dto.locationExact !== undefined) {
      const exactLocation = this.toGeoPoint(dto.locationExact) ?? null;
      updates.locationExact = exactLocation;
      updates.locationPublic =
        dto.locationPublic !== undefined
          ? (this.toGeoPoint(dto.locationPublic) ?? null)
          : exactLocation
            ? approximatePublicLocation(exactLocation)
            : null;
    } else if (dto.locationPublic !== undefined) {
      updates.locationPublic = this.toGeoPoint(dto.locationPublic) ?? null;
    }

    updates.updatedAt = new Date();
    await this.propertyRepository.update(property.id, updates);

    return this.getDetail(property.id, userId);
  }

  async replaceAmenities(
    propertyId: string,
    userId: string,
    dto: UpdatePropertyAmenitiesDto,
  ): Promise<PropertyAmenitiesResponseDto> {
    const amenityIds = [...new Set(dto.amenityIds)];
    await this.assertAmenitiesExist(amenityIds);

    await this.dataSource.transaction(async (manager) => {
      const property = await this.findPropertyForUpdate(manager, propertyId);
      this.assertPropertyExists(property);
      this.assertOwner(property, userId);
      assertEditableStatus(property.status);

      const repository = manager.getRepository(PropertyAmenity);
      await repository.delete({ propertyId });
      if (amenityIds.length > 0) {
        await repository.insert(
          amenityIds.map((amenityId) => ({ propertyId, amenityId })),
        );
      }
    });

    return this.queryService.getAmenitiesForProperty(propertyId);
  }

  async submitReview(
    propertyId: string,
    userId: string,
  ): Promise<PropertyDetailDto> {
    await this.dataSource.transaction(async (manager) => {
      const property = await this.findPropertyForUpdate(manager, propertyId);
      this.assertPropertyExists(property);
      this.assertOwner(property, userId);
      assertCanSubmitReview(property.status);

      await this.assertCatalogConsistency(property.cityId, property.zoneId);
      this.assertPropertyComplete(property);

      const fromStatus = property.status;
      property.status = 'in_review';
      property.rejectionReason = null;
      property.reviewedAt = null;

      await manager.getRepository(Property).save(property);
      await this.recordStatusHistory(
        manager,
        property.id,
        userId,
        fromStatus,
        'in_review',
      );
    });

    return this.getDetail(propertyId, userId);
  }

  async changeStatus(
    propertyId: string,
    userId: string,
    dto: ChangePropertyStatusDto,
  ): Promise<PropertyDetailDto> {
    await this.dataSource.transaction(async (manager) => {
      const property = await this.findPropertyForUpdate(manager, propertyId);
      this.assertPropertyExists(property);
      this.assertOwner(property, userId);
      assertLandlordStatusTransition(property.status, dto.status);

      const fromStatus = property.status;
      property.status = dto.status;

      if (dto.status === 'active' && property.publishedAt === null) {
        property.publishedAt = new Date();
      }

      await manager.getRepository(Property).save(property);
      await this.recordStatusHistory(
        manager,
        property.id,
        userId,
        fromStatus,
        dto.status,
        dto.reason ?? null,
      );
    });

    return this.getDetail(propertyId, userId);
  }

  async delete(propertyId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const property = await this.findPropertyForUpdate(manager, propertyId);
      this.assertPropertyExists(property);
      this.assertOwner(property, userId);
      assertTransition(property.status, 'deleted');

      const fromStatus = property.status;
      property.status = 'deleted';
      property.deletedAt = new Date();

      await manager.getRepository(Property).save(property);
      await this.recordStatusHistory(
        manager,
        property.id,
        userId,
        fromStatus,
        'deleted',
      );
    });
  }

  async addFavorite(propertyId: string, userId: string): Promise<void> {
    await this.assertActiveUser(userId);

    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (
      !property ||
      property.deletedAt !== null ||
      property.status !== 'active'
    ) {
      throw new NotFoundException('Property not found');
    }

    await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .values({ userId, propertyId })
      .orIgnore()
      .execute();
  }

  async removeFavorite(propertyId: string, userId: string): Promise<void> {
    await this.assertActiveUser(userId);
    await this.favoriteRepository.delete({ userId, propertyId });
  }

  async findFavorites(
    userId: string,
    filters: PaginationQueryDto,
  ): Promise<FavoritePropertyListResponseDto> {
    await this.assertActiveUser(userId);
    return this.queryService.findFavorites(userId, filters);
  }

  async findContacts(
    propertyId: string,
    userId: string,
    filters: ContactsQueryDto,
  ): Promise<PropertyContactListResponseDto> {
    const property = await this.getOwnedProperty(propertyId, userId);
    return this.queryService.findContacts(property.id, filters);
  }

  private async getOwnedProperty(
    propertyId: string,
    userId: string,
  ): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    this.assertPropertyExists(property);
    this.assertOwner(property, userId);
    return property;
  }

  private async assertCanCreateProperty(userId: string): Promise<void> {
    const user = await this.queryService.getUserSnapshot(userId);

    if (!user || user.status !== 'active') {
      throw new ForbiddenException(
        'An active user account is required to create a property',
      );
    }

    if (user.identityStatus !== 'verified') {
      throw new ForbiddenException(
        'Identity verification is required to create a property',
      );
    }

    if (user.landlordEnabledAt === null) {
      throw new ForbiddenException(
        'Landlord mode must be enabled to create a property',
      );
    }
  }

  private async assertActiveUser(userId: string): Promise<void> {
    const user = await this.queryService.getUserSnapshot(userId);

    if (!user || user.status !== 'active') {
      throw new ForbiddenException('An active user account is required');
    }
  }

  private async resolveCatalog(
    cityId: string | null,
    zoneId: string | null,
  ): Promise<{ cityId: string | null; zoneId: string | null }> {
    if (zoneId !== null) {
      const zone = await this.queryService.getZone(zoneId);

      if (!zone || !zone.isActive) {
        throw new BadRequestException(
          'zoneId does not reference an active zone',
        );
      }

      if (cityId !== null && cityId !== zone.cityId) {
        throw new BadRequestException(
          'zoneId does not belong to the provided cityId',
        );
      }

      const city = await this.queryService.getCity(zone.cityId);
      if (!city || !city.isActive) {
        throw new BadRequestException(
          'The city of the provided zone is not active',
        );
      }

      return { cityId: zone.cityId, zoneId };
    }

    if (cityId !== null) {
      const city = await this.queryService.getCity(cityId);
      if (!city || !city.isActive) {
        throw new BadRequestException(
          'cityId does not reference an active city',
        );
      }
    }

    return { cityId, zoneId: null };
  }

  private async assertCatalogConsistency(
    cityId: string | null,
    zoneId: string | null,
  ): Promise<void> {
    if (cityId === null || zoneId === null) {
      return;
    }

    await this.resolveCatalog(cityId, zoneId);
  }

  private async assertAmenitiesExist(amenityIds: string[]): Promise<void> {
    if (amenityIds.length === 0) {
      return;
    }

    const amenities = await this.queryService.getAmenitiesByIds(amenityIds);
    const byId = new Map(amenities.map((amenity) => [amenity.id, amenity]));
    const invalid = amenityIds.filter(
      (amenityId) => byId.get(amenityId)?.isActive !== true,
    );

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid or inactive amenityIds: ${invalid.join(', ')}`,
      );
    }
  }

  private assertPropertyComplete(property: Property): void {
    const missing: string[] = [];

    if (!property.title?.trim()) missing.push('title');
    if (property.propertyType === null) missing.push('propertyType');
    if (property.cityId === null) missing.push('cityId');
    if (property.zoneId === null) missing.push('zoneId');
    if (property.rentAmount === null) missing.push('rentAmount');
    if (property.availableFrom === null) missing.push('availableFrom');
    if (property.locationPublic === null) missing.push('locationPublic');

    if (missing.length > 0) {
      throw new BadRequestException(
        `Property is incomplete. Missing fields: ${missing.join(', ')}`,
      );
    }
  }

  private assertPropertyExists(
    property: Property | null,
  ): asserts property is Property {
    if (
      !property ||
      property.deletedAt !== null ||
      property.status === 'deleted'
    ) {
      throw new NotFoundException('Property not found');
    }
  }

  private assertOwner(property: Property, userId: string): void {
    if (property.landlordId !== userId) {
      throw new ForbiddenException('You do not own this property');
    }
  }

  private async findPropertyForUpdate(
    manager: EntityManager,
    propertyId: string,
  ): Promise<Property | null> {
    return manager
      .getRepository(Property)
      .createQueryBuilder('p')
      .addSelect(['p.addressExact', 'p.locationExact'])
      .where('p.id = :propertyId', { propertyId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async recordStatusHistory(
    manager: EntityManager,
    propertyId: string,
    changedBy: string | null,
    fromStatus: PropertyStatus | null,
    toStatus: PropertyStatus,
    reason: string | null = null,
  ): Promise<void> {
    await manager.getRepository(PropertyStatusHistory).insert({
      propertyId,
      changedBy,
      fromStatus,
      toStatus,
      reason,
    });
  }

  private toMoney(value: number): string {
    return value.toFixed(2);
  }

  private toGeoPoint(
    value: PointDto | null | undefined,
  ): GeoPoint | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    return { latitude: value.latitude, longitude: value.longitude };
  }
}
