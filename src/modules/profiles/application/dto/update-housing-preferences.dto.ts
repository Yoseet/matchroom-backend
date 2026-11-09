import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const PROPERTY_TYPES = ['room', 'apartment', 'any'] as const;
const MAX_MONEY = 9999999999.99;

const emptyToNull = ({ value }: TransformFnParams): unknown =>
  value === '' ? null : value;

/**
 * PUT body for `housing_preferences`. Numbers are stored as `numeric(12,2)` by
 * PostgreSQL and returned as strings in the response DTOs.
 */
export class UpdateHousingPreferencesDto {
  @ApiPropertyOptional({ enum: PROPERTY_TYPES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(PROPERTY_TYPES)
  propertyType?: (typeof PROPERTY_TYPES)[number] | null;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_MONEY, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  budgetMin?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_MONEY, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  budgetMax?: number | null;

  @ApiPropertyOptional({ example: '2026-12-01', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'moveInDate must use the YYYY-MM-DD format',
  })
  @IsDateString({ strict: true })
  moveInDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null significa indiferente.',
  })
  @IsOptional()
  @Transform(emptyToNull)
  @IsBoolean()
  requiresFurnished?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsBoolean()
  requiresPetsAllowed?: boolean | null;
}

export { MAX_MONEY, PROPERTY_TYPES };
