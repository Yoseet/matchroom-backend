import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_PATTERN = /(?=.*[A-Za-z])(?=.*\d)/;
const PASSWORD_MESSAGE =
  'password must include at least one letter and one number';

export class RegisterDto {
  @IsEmail() @MaxLength(254)
  email: string;

  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms and privacy notice' })
  acceptTerms: boolean;

  @IsBoolean()
  @Equals(true, { message: 'You must declare that you are at least 18 years old' })
  adultDeclared: boolean;
}

export class LoginDto {
  @IsEmail() @MaxLength(254)
  email: string;

  @IsString() @MinLength(1) @MaxLength(72)
  password: string;
}

export class GoogleLoginDto {
  @IsString() @MinLength(20) @MaxLength(4096)
  credential: string;

  /**
   * Only required when the Google email already belongs to a password
   * account. It proves ownership before linking the Google identity.
   */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(72)
  linkPassword?: string;
}

export class LegalAcceptanceDto {
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms and privacy notice' })
  acceptTerms: boolean;

  @IsBoolean()
  @Equals(true, { message: 'You must declare that you are at least 18 years old' })
  adultDeclared: boolean;
}

export class VerifyEmailDto {
  @IsString() @MinLength(20) @MaxLength(512)
  token: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(512)
  token: string;

  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(72)
  currentPassword: string;

  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class UpdateModeDto {
  @IsIn(['seeker', 'landlord'])
  mode: 'seeker' | 'landlord';
}

export class DeleteAccountDto {
  /**
   * Required for accounts with a password. Google-only accounts confirm with
   * `confirm: true` instead (they have no password to compare).
   */
  @IsOptional() @IsString() @MaxLength(72)
  password?: string;

  @IsOptional() @IsBoolean()
  confirm?: boolean;
}

export class PublicUserDto {
  id: string;
  email: string;
  activeMode: 'seeker' | 'landlord';
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
}

export class AuthResponseDto {
  user: PublicUserDto;
}

export class DeletionScheduledDto {
  scheduledAt: string;
}
