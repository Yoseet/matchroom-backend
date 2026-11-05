import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthIdentity,
  LegalAcceptance,
  OneTimeToken,
  User,
  UserSession,
} from './domain/entities/index.js';

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
  ],
})
export class AccountsModule {}
