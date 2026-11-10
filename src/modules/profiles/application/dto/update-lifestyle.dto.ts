import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const VISITS_FREQUENCIES = ['never', 'rare', 'sometimes', 'often'] as const;
const SLEEP_SCHEDULES = ['early', 'regular', 'late'] as const;
const WORK_SCHEDULES = [
  'morning',
  'afternoon',
  'night',
  'remote',
  'flexible',
] as const;
const COHABITATION_TYPES = [
  'join_existing_home',
  'find_place_together',
  'any',
] as const;

const emptyToNull = ({ value }: TransformFnParams): unknown =>
  value === '' ? null : value;

/**
 * PUT body for `lifestyle_profiles`. Every field is nullable: omitted fields
 * are cleared, so this endpoint behaves as a full replacement.
 */
export class UpdateLifestyleDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsInt()
  @Min(1)
  @Max(5)
  cleanlinessLevel?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsBoolean()
  smokes?: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsBoolean()
  hasPets?: boolean | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsInt()
  @Min(1)
  @Max(5)
  noiseLevel?: number | null;

  @ApiPropertyOptional({ enum: VISITS_FREQUENCIES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(VISITS_FREQUENCIES)
  visitsFrequency?: (typeof VISITS_FREQUENCIES)[number] | null;

  @ApiPropertyOptional({ enum: SLEEP_SCHEDULES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(SLEEP_SCHEDULES)
  sleepSchedule?: (typeof SLEEP_SCHEDULES)[number] | null;

  @ApiPropertyOptional({ enum: WORK_SCHEDULES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(WORK_SCHEDULES)
  workSchedule?: (typeof WORK_SCHEDULES)[number] | null;

  @ApiPropertyOptional({ enum: COHABITATION_TYPES, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(COHABITATION_TYPES)
  cohabitationType?: (typeof COHABITATION_TYPES)[number] | null;
}

export {
  COHABITATION_TYPES,
  SLEEP_SCHEDULES,
  VISITS_FREQUENCIES,
  WORK_SCHEDULES,
};
