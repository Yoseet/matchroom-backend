import { SetMetadata } from '@nestjs/common';

export const AUTH_RATE_LIMIT = 'authRateLimit';
export const AuthRateLimit = (limit: number, windowMs: number) =>
  SetMetadata(AUTH_RATE_LIMIT, { limit, windowMs });
