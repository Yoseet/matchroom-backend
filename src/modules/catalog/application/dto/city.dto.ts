import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from './pagination.dto.js';

export class ListCitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtra las ciudades que tengan al menos una zona activa con este código postal.',
    example: '06700',
    pattern: '^\\d{5}$',
  })
  @IsOptional()
  @Matches(/^\d{5}$/)
  postalCode?: string;

  @ApiPropertyOptional({
    description:
      'Filtra las ciudades por nombre de estado (sin distinguir mayúsculas).',
    example: 'Jalisco',
    maxLength: 100,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stateName?: string;
}

export class CityResponseDto {
  @ApiProperty({
    description: 'Identificador de la ciudad.',
    format: 'uuid',
    example: '2f7d5a8c-1b3e-4f0a-9c6d-5e4b3a291807',
  })
  id: string;

  @ApiProperty({ example: 'Ciudad de México' })
  name: string;

  @ApiProperty({ example: 'Ciudad de México' })
  stateName: string;

  @ApiProperty({ example: 'MX' })
  countryCode: string;
}

export class PaginatedCitiesResponseDto {
  @ApiProperty({ type: [CityResponseDto] })
  data: CityResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
