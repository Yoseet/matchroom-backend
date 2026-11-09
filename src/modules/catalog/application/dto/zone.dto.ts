import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationMetaDto, PaginationQueryDto } from './pagination.dto.js';

export class ListZonesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Filtra las zonas de una ciudad. Si se omite, devuelve zonas de todas las ciudades activas.',
    format: 'uuid',
    example: '2f7d5a8c-1b3e-4f0a-9c6d-5e4b3a291807',
  })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiPropertyOptional({
    description: 'Filtra las zonas por código postal.',
    example: '06700',
    pattern: '^\\d{5}$',
  })
  @IsOptional()
  @Matches(/^\d{5}$/)
  postalCode?: string;
}

export class ZoneResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '6a0c2a92-75d7-4d5a-87ab-6b9a7a8f9c10',
  })
  id: string;

  @ApiProperty({
    description: 'Ciudad a la que pertenece la zona.',
    format: 'uuid',
    example: '2f7d5a8c-1b3e-4f0a-9c6d-5e4b3a291807',
  })
  cityId: string;

  @ApiProperty({ example: 'Ciudad de México' })
  cityName: string;

  @ApiProperty({ example: 'Ciudad de México' })
  stateName: string;

  @ApiProperty({ example: 'Roma Norte' })
  name: string;

  @ApiProperty({ example: 'roma-norte' })
  slug: string;

  @ApiProperty({
    description: 'Código postal de la zona.',
    example: '06700',
    nullable: true,
    pattern: '^\\d{5}$',
  })
  postalCode: string | null;
}

export class PaginatedZonesResponseDto {
  @ApiProperty({ type: [ZoneResponseDto] })
  data: ZoneResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
