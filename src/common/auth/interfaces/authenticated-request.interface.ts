import type { Request } from 'express';
import type { AuthUser } from './auth-user.interface.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
