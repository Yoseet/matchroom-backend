import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export const USER_ID_HEADER = 'x-user-id';

/** Resolves the user id established by SessionGuard; never trusts a request header. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { authenticatedUserId?: string }>();
    if (!request.authenticatedUserId) throw new UnauthorizedException('Authentication is required');
    return request.authenticatedUserId;
  },
);
