import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, {
    message: 'password must contain at least one letter and one number',
  })
  newPassword: string;
}
