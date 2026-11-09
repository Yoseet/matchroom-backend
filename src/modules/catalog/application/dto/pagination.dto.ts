import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Offset pagination, used by catalogs (cities, zones and autocomplete). */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página (empieza en 1).',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página.',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Página actual (1-based).', example: 1 })
  page: number;

  @ApiProperty({
    description: 'Elementos solicitados por página.',
    example: 20,
  })
  pageSize: number;

  @ApiProperty({
    description: 'Total de elementos que coinciden con los filtros.',
    example: 659,
  })
  total: number;

  @ApiProperty({
    description: 'Total de páginas disponibles.',
    example: 33,
  })
  totalPages: number;
}
