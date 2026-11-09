import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from './pagination.dto.js';

export type AutocompleteType = 'all' | 'cities' | 'zones';

export const AUTOCOMPLETE_TYPES: AutocompleteType[] = [
  'all',
  'cities',
  'zones',
];

export class AutocompleteQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description:
      'Texto a buscar en el nombre de la ciudad o zona, o en el código postal.',
    minLength: 2,
    maxLength: 100,
    example: 'roma',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;

  @ApiPropertyOptional({
    description:
      'Limita los resultados a ciudades, zonas o ambos (valor por defecto).',
    enum: AUTOCOMPLETE_TYPES,
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsIn(AUTOCOMPLETE_TYPES)
  type: AutocompleteType = 'all';
}

export class AutocompleteItemDto {
  @ApiProperty({
    description: 'Tipo de resultado.',
    enum: ['city', 'zone'],
    example: 'zone',
  })
  type: 'city' | 'zone';

  @ApiProperty({
    format: 'uuid',
    example: '6a0c2a92-75d7-4d5a-87ab-6b9a7a8f9c10',
  })
  id: string;

  @ApiProperty({ example: 'Roma Norte' })
  name: string;

  @ApiProperty({ example: 'Ciudad de México' })
  stateName: string;

  @ApiProperty({
    description: 'Ciudad de la zona. Es null para resultados de tipo city.',
    format: 'uuid',
    nullable: true,
    example: '2f7d5a8c-1b3e-4f0a-9c6d-5e4b3a291807',
  })
  cityId: string | null;

  @ApiProperty({
    description: 'Nombre de la ciudad. Es null para resultados de tipo city.',
    nullable: true,
    example: 'Ciudad de México',
  })
  cityName: string | null;

  @ApiProperty({
    description:
      'Código postal de la zona. Es null para resultados de tipo city.',
    nullable: true,
    example: '06700',
  })
  postalCode: string | null;
}

export class PaginatedAutocompleteResponseDto {
  @ApiProperty({ type: [AutocompleteItemDto] })
  data: AutocompleteItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
