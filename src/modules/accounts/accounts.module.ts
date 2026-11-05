import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthIdentity,
  LegalAcceptance,
  OneTimeToken,
  User,
  UserSession,
} from './domain/entities/index.js';
import { ProfilesModule } from '../profiles/index.js';
import { PrivacyModule } from '../privacy/index.js';
import { AuthService } from './application/services/auth.service.js';
import { PasswordHasher } from './application/services/password-hasher.service.js';
import { TokenService } from './application/services/token.service.js';
import { AuthController } from './presentation/controllers/auth.controller.js';

/**
 * Accounts bounded context: identity, authentication sessions, one-time
 * tokens and legal acceptance records.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthIdentity,
      UserSession,
      OneTimeToken,
      LegalAcceptance,
    ]),
    ProfilesModule,
    PrivacyModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, TokenService],
  exports: [AuthService],
})
export class AccountsModule {}
