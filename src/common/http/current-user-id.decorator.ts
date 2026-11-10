import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

/**
 * Temporary identity transport while the accounts/auth module is not
 * implemented. Once JWT authentication lands, controllers should switch to
 * the global `@CurrentUser()` decorator and this header must be removed.
 */
export const CURRENT_USER_ID_HEADER = 'x-user-id';

export const CURRENT_USER_ID_DESCRIPTION =
  'UUID del usuario actual. Header temporal mientras el módulo de autenticación no está implementado.';

function readUserId(request: Request): string | undefined {
  const header = request.header(CURRENT_USER_ID_HEADER);
  if (header === undefined) {
    return undefined;
  }

  const userId = header.trim();
  if (!userId || !isUUID(userId, 'all')) {
    throw new BadRequestException(
      `${CURRENT_USER_ID_HEADER} must be a valid UUID`,
    );
  }

  return userId;
}

/** Requires the temporary user header and returns the UUID. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const userId = readUserId(context.switchToHttp().getRequest<Request>());

    if (!userId) {
      throw new BadRequestException(
        `${CURRENT_USER_ID_HEADER} header is required until authentication is implemented`,
      );
    }

    return userId;
  },
);

/** Reads the temporary user header when present. */
export const OptionalCurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    readUserId(context.switchToHttp().getRequest<Request>()),
);
