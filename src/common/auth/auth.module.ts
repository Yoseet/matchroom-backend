import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { SessionValidatorService } from './services/session-validator.service.js';

/**
 * Shared authentication infrastructure.
 *
 * `JwtModule` is registered without default options on purpose: every sign and
 * verify call provides the corresponding secret from `env.ts`, so access and
 * refresh tokens can use different keys.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    JwtAuthGuard,
    SessionValidatorService,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
  ],
  exports: [JwtModule, JwtAuthGuard, SessionValidatorService],
})
export class CommonAuthModule {}
