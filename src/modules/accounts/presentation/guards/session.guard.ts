import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../application/services/auth.service.js';

export interface AuthenticatedRequest extends Request { authenticatedUserId?: string }

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readCookie(request.headers.cookie);
    const user = await this.authService.getUserFromSession(token);
    if (!user) throw new UnauthorizedException('Authentication is required');
    request.authenticatedUserId = user.id;
    return true;
  }

  private readCookie(header?: string): string | undefined {
    if (!header) return undefined;
    const prefix = `${this.authService.cookieName}=`;
    return header.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix))?.slice(prefix.length);
  }
}
