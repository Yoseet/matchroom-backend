import { ApiProperty } from '@nestjs/swagger';
import type {
  IdentityStatus,
  UserActiveMode,
  UserStatus,
} from '../../domain/entities/index.js';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({
    enum: ['active', 'pending_deletion', 'suspended', 'deleted'],
  })
  status: UserStatus;

  @ApiProperty({ enum: ['seeker', 'landlord'] })
  activeMode: UserActiveMode;

  @ApiProperty({
    enum: [
      'not_started',
      'in_progress',
      'verified',
      'rejected',
      'manual_review',
    ],
  })
  identityStatus: IdentityStatus;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;
}
