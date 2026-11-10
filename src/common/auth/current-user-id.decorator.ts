import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

/** Temporary header used until the authentication module is wired in. */
export const USER_ID_HEADER = 'x-user-id';

/**
 * Resolves the acting user id from `x-user-id`.
 *
 * Authentication/authorization is intentionally out of scope for the profiles
 * feature. Once the auth module lands, controllers should switch to
 * `@CurrentUser()` and this decorator can be deleted.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const header = request.headers[USER_ID_HEADER];
    const userId = Array.isArray(header) ? header[0] : header;

    if (!userId || !isUUID(userId)) {
      throw new UnauthorizedException(
        `Missing or invalid ${USER_ID_HEADER} header`,
      );
    }

    return userId;
  },
);
