import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IdentityVerification,
  PrivacyRequest,
  PrivacySetting,
} from './domain/entities/index.js';
import { PrivacyService } from './application/services/privacy.service.js';

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
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
