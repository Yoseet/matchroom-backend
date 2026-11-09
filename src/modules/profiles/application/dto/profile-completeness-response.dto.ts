import { ApiProperty } from '@nestjs/swagger';

export class MissingProfileFieldDto {
  @ApiProperty({
    enum: [
      'personal',
      'lifestyle',
      'roommate_preferences',
      'housing_preferences',
      'zones',
      'amenities',
    ],
  })
  section:
    | 'personal'
    | 'lifestyle'
    | 'roommate_preferences'
    | 'housing_preferences'
    | 'zones'
    | 'amenities';

  @ApiProperty({ example: 'birthDate' })
  field: string;

  @ApiProperty({ example: 'Fecha de nacimiento' })
  label: string;
}

export class ProfileCompletenessResponseDto {
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Porcentaje de completitud del perfil.',
  })
  completenessPct: number;

  @ApiProperty({
    type: [MissingProfileFieldDto],
    description: 'Campos que faltan para llegar a 100.',
  })
  missingFields: MissingProfileFieldDto[];
}
