import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_RATE_LIMIT } from './rate-limit.decorator.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<{ limit: number; windowMs: number }>(AUTH_RATE_LIMIT, [context.getHandler(), context.getClass()]);
    if (!options) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${context.getHandler().name}:${request.ip || request.socket.remoteAddress || 'unknown'}`;
    const now = Date.now(); const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : existing;
    bucket.count += 1; this.buckets.set(key, bucket);
    if (bucket.count > options.limit) throw new HttpException('Too many attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
