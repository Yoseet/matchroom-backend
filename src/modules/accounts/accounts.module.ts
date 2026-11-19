import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthIdentity,
  LegalAcceptance,
  OneTimeToken,
  User,
  UserSession,
} from './domain/entities/index.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { AccountsMaintenanceService } from './application/services/accounts-maintenance.service.js';
import { AuthService } from './application/services/auth.service.js';
import { MailService } from './application/services/mail.service.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { AuthRateLimitGuard } from './presentation/guards/auth-rate-limit.guard.js';
import { SessionGuard } from './presentation/guards/session.guard.js';

/**
 * Accounts bounded context: identity, authentication sessions, one-time
 * tokens and legal acceptance records.
 */
@Module({
  imports: [
    forwardRef(() => ProfilesModule),
    TypeOrmModule.forFeature([
      User,
      AuthIdentity,
      UserSession,
      OneTimeToken,
      LegalAcceptance,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    AccountsMaintenanceService,
    AuthRateLimitGuard,
    SessionGuard,
  ],
  exports: [AuthService, AccountsMaintenanceService, SessionGuard],
})
export class AccountsModule {}
