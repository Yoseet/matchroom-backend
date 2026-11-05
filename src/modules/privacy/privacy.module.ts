import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IdentityVerification,
  PrivacyRequest,
  PrivacySetting,
} from './domain/entities/index.js';

/**
 * Privacy bounded context: visibility settings, data-subject requests and
 * identity-verification attempts.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrivacySetting,
      PrivacyRequest,
      IdentityVerification,
    ]),
  ],
})
export class PrivacyModule {}
