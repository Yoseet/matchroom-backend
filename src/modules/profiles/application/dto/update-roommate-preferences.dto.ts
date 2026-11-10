import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXCLUSIVE_CRITERIA,
  type ExclusiveCriterion,
} from '../../domain/entities/index.js';

const POLICY_VALUES = ['accept', 'reject', 'indifferent'] as const;
const VISITS_FREQUENCIES = ['never', 'rare', 'sometimes', 'often'] as const;

const emptyToNull = ({ value }: TransformFnParams): unknown =>
  value === '' ? null : value;

/**
 * PUT body for `roommate_preferences`. It describes what the user accepts from
 * a potential roommate. `exclusiveCriteria` marks filters that are applied as
 * eligibility rules by the matching module.
 */
export class UpdateRoommatePreferencesDto {
  @ApiPropertyOptional({ enum: POLICY_VALUES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(POLICY_VALUES)
  smokingPolicy?: (typeof POLICY_VALUES)[number] | null;

  @ApiPropertyOptional({ enum: POLICY_VALUES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(POLICY_VALUES)
  petsPolicy?: (typeof POLICY_VALUES)[number] | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsInt()
  @Min(1)
  @Max(5)
  maxNoiseLevel?: number | null;

  @ApiPropertyOptional({ enum: VISITS_FREQUENCIES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(VISITS_FREQUENCIES)
  maxVisitsFrequency?: (typeof VISITS_FREQUENCIES)[number] | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsInt()
  @Min(1)
  @Max(5)
  minCleanlinessLevel?: number | null;

  @ApiPropertyOptional({ minimum: 18, maximum: 120, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsInt()
  @Min(18)
  @Max(120)
  minAge?: number | null;

  @ApiPropertyOptional({ minimum: 18, maximum: 120, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsInt()
  @Min(18)
  @Max(120)
  maxAge?: number | null;

  @ApiPropertyOptional({
    enum: EXCLUSIVE_CRITERIA,
    isArray: true,
    description:
      'Criterios que se usan como filtro de elegibilidad, no como puntuación.',
    example: ['smoking', 'pets'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(EXCLUSIVE_CRITERIA, { each: true })
  exclusiveCriteria?: ExclusiveCriterion[];
}

export { POLICY_VALUES };
