import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 320 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({
    example: 'Password123',
    minLength: 8,
    maxLength: 72,
    description: 'Al menos 8 caracteres, con letras y números',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, {
    message: 'password must contain at least one letter and one number',
  })
  password: string;

  @ApiProperty({
    example: true,
    description: 'Aceptación de términos y aviso de privacidad',
  })
  @IsBoolean()
  @Equals(true, {
    message: 'you must accept the terms and privacy notice',
  })
  acceptedTerms: boolean;

  @ApiProperty({
    example: true,
    description: 'Declaración de mayoría de edad',
  })
  @IsBoolean()
  @Equals(true, { message: 'you must declare that you are 18 or older' })
  adultDeclared: boolean;
}
