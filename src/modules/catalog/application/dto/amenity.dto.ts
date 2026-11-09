import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto, PaginationQueryDto } from './pagination.dto.js';

export class ListAmenitiesQueryDto extends PaginationQueryDto {}

export class AmenityResponseDto {
  @ApiProperty({
    description: 'Identificador de la amenidad.',
    format: 'uuid',
    example: '5d6f2a10-4f8e-4c2b-9f19-123456789abc',
  })
  id: string;

  @ApiProperty({
    description: 'Código estable de la amenidad.',
    example: 'estacionamiento',
  })
  code: string;

  @ApiProperty({
    description: 'Nombre para mostrar en la aplicación.',
    example: 'Estacionamiento',
  })
  name: string;

  @ApiProperty({
    description: 'Indica si la amenidad está disponible para la API.',
    example: true,
  })
  isActive: boolean;
}

export class PaginatedAmenitiesResponseDto {
  @ApiProperty({ type: [AmenityResponseDto] })
  data: AmenityResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
