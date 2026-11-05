import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { env } from '../../../config/env.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SessionValidatorService } from '../services/session-validator.service.js';
import type { AccessTokenPayload } from '../interfaces/auth-user.interface.js';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface.js';

/**
 * Global authentication guard.
 *
 * Verifies the short-lived access token and exposes `{ userId, sessionId }`.
 * Refresh tokens are never accepted here: their type is checked explicitly.
 * Routes marked with `@Public()` are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionValidator: SessionValidatorService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const sessionIsActive = await this.sessionValidator.isSessionActive(
      payload.sub,
      payload.sid,
    );

    if (!sessionIsActive) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    request.user = {
      userId: payload.sub,
      sessionId: payload.sid,
    };

    return true;
  }
}
