import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Full replacement of the current user's preferred zones. */
export class UpdatePreferredZonesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Reemplaza la selección completa. Un arreglo vacío la limpia.',
    example: ['018f3b1a-8f24-7b35-a1c2-3d4e5f607182'],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  zoneIds: string[];
}

/** Adds zones to the current selection without removing existing ones. */
export class AddPreferredZonesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Zonas que se agregan a la selección actual.',
    example: ['018f3b1a-8f24-7b35-a1c2-3d4e5f607182'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  zoneIds: string[];
}
