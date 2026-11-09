import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { LookingFor } from '../../domain/entities/index.js';

const LOOKING_FOR_VALUES: LookingFor[] = ['roommate', 'housing', 'both'];

const trimToNull = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * Personal data of the current user's profile.
 *
 * All fields are optional because this DTO backs a PATCH operation. Sending
 * `null` (or an empty string for text fields) clears a value.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(80)
  firstName?: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(80)
  lastName?: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento en formato YYYY-MM-DD. Debe ser mayor de edad.',
    example: '1998-04-21',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must use the YYYY-MM-DD format',
  })
  @IsDateString({ strict: true })
  birthDate?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(50)
  gender?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(120)
  occupation?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true, example: '+525512345678' })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+()\-\s]+$/, {
    message: 'contactPhone contains invalid characters',
  })
  contactPhone?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Media asset propio de tipo profile_photo.',
  })
  @IsOptional()
  @IsUUID()
  photoAssetId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  cityId?: string | null;

  @ApiPropertyOptional({ enum: LOOKING_FOR_VALUES, example: 'both' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(LOOKING_FOR_VALUES)
  lookingFor?: LookingFor;
}

