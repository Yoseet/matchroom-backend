import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { LookingFor } from '../../domain/entities/index.js';

const LOOKING_FOR_VALUES: LookingFor[] = ['roommate', 'housing', 'both'];

export class ListProfilesQueryDto {
  @ApiPropertyOptional({
    enum: LOOKING_FOR_VALUES,
    description:
      'Filtra por lo que busca el perfil. `roommate` incluye `roommate` y ' +
      '`both`; `housing` incluye `housing` y `both`; `both` (u omitido) no ' +
      'restringe el tipo de búsqueda.',
  })
  @IsOptional()
  @IsIn(LOOKING_FOR_VALUES)
  lookingFor?: LookingFor;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor opaco devuelto en `nextCursor` por la página anterior.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export { LOOKING_FOR_VALUES };
