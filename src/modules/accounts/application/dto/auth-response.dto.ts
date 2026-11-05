import { ApiProperty } from '@nestjs/swagger';
import { AuthTokensDto } from './auth-tokens.dto.js';
import { AuthUserDto } from './auth-user.dto.js';

export class AuthResponseDto {
  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: () => AuthTokensDto })
  tokens: AuthTokensDto;
}
