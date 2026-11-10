import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { PROPERTY_SORTS, PROPERTY_TYPES } from '../property-status.js';
import { PaginationQueryDto } from './pagination-query.dto.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const parsed = values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

function toBoolean(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

export class SearchPropertiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  cityId?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('all', { each: true })
  zoneIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  type?: (typeof PROPERTY_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  furnished?: boolean;

  @IsOptional()
  @Matches(DATE_ONLY, {
    message: 'availableFrom must use the YYYY-MM-DD format',
  })
  availableFrom?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsUUID('all', { each: true })
  amenityIds?: string[];

  @IsOptional()
  @IsIn(PROPERTY_SORTS)
  sort?: (typeof PROPERTY_SORTS)[number];
}
