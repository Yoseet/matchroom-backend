export { CommonAuthModule } from './auth.module.js';
export { CurrentUser } from './decorators/current-user.decorator.js';
export { Public } from './decorators/public.decorator.js';
export { JwtAuthGuard } from './guards/jwt-auth.guard.js';
export { SessionValidatorService } from './services/session-validator.service.js';
export type { AuthUser } from './interfaces/auth-user.interface.js';
export type { AuthenticatedRequest } from './interfaces/authenticated-request.interface.js';
