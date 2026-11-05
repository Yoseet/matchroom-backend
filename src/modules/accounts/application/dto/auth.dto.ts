import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must include at least one letter and one number',
  })
  password: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential: string;
}

export class PublicUserDto {
  id: string;
  email: string;
  activeMode: 'seeker' | 'landlord';
}

export class AuthResponseDto {
  user: PublicUserDto;
}
