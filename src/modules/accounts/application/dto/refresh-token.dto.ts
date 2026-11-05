import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token emitido por login o registro' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
