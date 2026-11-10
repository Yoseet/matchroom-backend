import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Full replacement of the current user's desired amenities. */
export class UpdatePreferredAmenitiesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Reemplaza la selección completa. Un arreglo vacío la limpia.',
    example: ['018f3b1a-8f24-7b35-a1c2-3d4e5f607182'],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  amenityIds: string[];
}

/** Adds amenities to the current selection without removing existing ones. */
export class AddPreferredAmenitiesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Amenidades que se agregan a la selección actual.',
    example: ['018f3b1a-8f24-7b35-a1c2-3d4e5f607182'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  amenityIds: string[];
}
