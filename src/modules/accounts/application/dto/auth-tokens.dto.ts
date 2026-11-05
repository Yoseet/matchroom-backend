import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({ description: 'JWT de acceso de corta duración' })
  accessToken: string;

  @ApiProperty({ description: 'JWT de renovación con rotación en cada uso' })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900, description: 'Vigencia del access token en segundos' })
  accessTokenExpiresIn: number;

  @ApiProperty({
    example: 604800,
    description: 'Vigencia del refresh token en segundos',
  })
  refreshTokenExpiresIn: number;
}
