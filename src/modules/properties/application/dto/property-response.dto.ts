import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  PropertyStatus,
  PropertyType,
} from '../../domain/entities/index.js';
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '../property-status.js';
import { PointDto } from './point.dto.js';

export class PropertyAmenityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

export class PropertySummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  title: string | null;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ enum: PROPERTY_TYPES, nullable: true })
  propertyType: PropertyType | null;

  @ApiProperty({ type: String, nullable: true })
  cityId: string | null;

  @ApiProperty({ type: String, nullable: true })
  cityName: string | null;

  @ApiProperty({ type: String, nullable: true })
  zoneId: string | null;

  @ApiProperty({ type: String, nullable: true })
  zoneName: string | null;

  @ApiProperty({ type: String, nullable: true, example: '3500.00' })
  rentAmount: string | null;

  @ApiProperty({ type: String, nullable: true, example: '3500.00' })
  depositAmount: string | null;

  @ApiProperty({ type: String, nullable: true, example: '450.00' })
  additionalCostsEstimate: string | null;

  @ApiProperty({ example: 'MXN' })
  currency: string;

  @ApiProperty({ type: String, nullable: true, example: '2026-12-01' })
  availableFrom: string | null;

  @ApiProperty({ type: Number, nullable: true })
  bedrooms: number | null;

  @ApiProperty({ type: Number, nullable: true })
  bathrooms: number | null;

  @ApiProperty()
  furnished: boolean;

  @ApiProperty()
  petsAllowed: boolean;

  @ApiProperty()
  smokersAllowed: boolean;

  @ApiProperty()
  requiresGuarantor: boolean;

  @ApiProperty()
  requiresIncomeProof: boolean;

  @ApiProperty({ type: Number, nullable: true })
  minContractMonths: number | null;

  @ApiProperty({ enum: PROPERTY_STATUSES })
  status: PropertyStatus;

  @ApiProperty({ type: String, nullable: true })
  publishedAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ type: () => PointDto, nullable: true })
  locationPublic: PointDto | null;

  @ApiProperty({ type: () => [PropertyAmenityDto] })
  amenities: PropertyAmenityDto[];
}

export class PropertyDetailDto extends PropertySummaryDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Solo se devuelve al arrendador propietario o al interesado con una conversación de renta válida.',
  })
  addressExact?: string | null;

  @ApiPropertyOptional({
    type: () => PointDto,
    nullable: true,
    description:
      'Solo se devuelve al arrendador propietario o al interesado con una conversación de renta válida.',
  })
  locationExact?: PointDto | null;

  @ApiProperty({ type: String, nullable: true })
  houseRules: string | null;

  @ApiProperty({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  reviewedAt: string | null;

  @ApiProperty({ type: String, nullable: true })
  expiresAt: string | null;
}

export class PropertyMapItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  title: string | null;

  @ApiProperty({ enum: PROPERTY_TYPES, nullable: true })
  propertyType: PropertyType | null;

  @ApiProperty({ type: String, nullable: true, example: '3500.00' })
  rentAmount: string | null;

  @ApiProperty({ example: 'MXN' })
  currency: string;

  @ApiProperty({ type: Number, nullable: true })
  bedrooms: number | null;

  @ApiProperty({ type: Number, nullable: true })
  bathrooms: number | null;

  @ApiProperty({ type: String, nullable: true })
  cityId: string | null;

  @ApiProperty({ type: String, nullable: true })
  zoneId: string | null;

  @ApiProperty({ type: () => PointDto })
  locationPublic: PointDto;
}

export class PropertyListResponseDto {
  @ApiProperty({ type: () => [PropertySummaryDto] })
  data: PropertySummaryDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}

export class PropertyMapResponseDto {
  @ApiProperty({ type: () => [PropertyMapItemDto] })
  data: PropertyMapItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}

export class PropertyAmenitiesResponseDto {
  @ApiProperty({ type: () => [PropertyAmenityDto] })
  data: PropertyAmenityDto[];
}

export class FavoritePropertyDto extends PropertySummaryDto {
  @ApiProperty()
  favoritedAt: string;

  @ApiProperty({
    description:
      'Indica si el anuncio sigue disponible; los favoritos no disponibles se conservan para que el cliente pueda marcarlos.',
  })
  isAvailable: boolean;
}

export class FavoritePropertyListResponseDto {
  @ApiProperty({ type: () => [FavoritePropertyDto] })
  data: FavoritePropertyDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}

export class PropertyContactDto {
  @ApiProperty()
  conversationId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: String, nullable: true })
  firstName: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastName: string | null;

  @ApiProperty({ type: String, nullable: true })
  photoAssetId: string | null;

  @ApiProperty({ type: String, nullable: true })
  contactPhone: string | null;

  @ApiProperty({ enum: ['active', 'closed'] })
  conversationStatus: 'active' | 'closed';

  @ApiProperty({ type: String, nullable: true })
  lastMessageAt: string | null;

  @ApiProperty()
  createdAt: string;
}

export class PropertyContactListResponseDto {
  @ApiProperty({ type: () => [PropertyContactDto] })
  data: PropertyContactDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;
}
