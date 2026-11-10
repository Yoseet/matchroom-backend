import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PROPERTY_TYPES } from '../property-status.js';
import { PointDto } from './point.dto.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A draft may be incomplete, so every field is optional. The completeness
 * required to leave `draft` is validated by the submit-review use case.
 */
export class CreatePropertyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  propertyType?: (typeof PROPERTY_TYPES)[number] | null;

  @IsOptional()
  @IsUUID('all')
  cityId?: string | null;

  @IsOptional()
  @IsUUID('all')
  zoneId?: string | null;

  @IsOptional()
  @IsString()
  addressExact?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PointDto)
  locationExact?: PointDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PointDto)
  locationPublic?: PointDto | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  rentAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  additionalCostsEstimate?: number | null;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'availableFrom must use the YYYY-MM-DD format',
  })
  availableFrom?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number | null;

  @IsOptional()
  @IsBoolean()
  furnished?: boolean;

  @IsOptional()
  @IsBoolean()
  petsAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  smokersAllowed?: boolean;

  @IsOptional()
  @IsString()
  houseRules?: string | null;

  @IsOptional()
  @IsBoolean()
  requiresGuarantor?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresIncomeProof?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minContractMonths?: number | null;
}
