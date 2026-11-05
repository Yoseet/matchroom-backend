import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetRequestedDto {
  @ApiProperty({
    example:
      'If the email is registered, a password reset link has been sent.',
  })
  message: string;

  @ApiProperty({
    required: false,
    description:
      'Solo se devuelve en desarrollo cuando AUTH_RETURN_RESET_TOKEN=true',
  })
  resetToken?: string;
}
