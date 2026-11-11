import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthResponseDto, GoogleLoginDto, LoginDto, RegisterDto } from '../../application/dto/auth.dto.js';
import { AuthService } from '../../application/services/auth.service.js';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard.js';
import { AuthRateLimit } from '../guards/rate-limit.decorator.js';
import { SessionGuard, type AuthenticatedRequest } from '../guards/session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @UseGuards(AuthRateLimitGuard) @AuthRateLimit(5, 15 * 60 * 1000)
  async register(@Body() input: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    const result = await this.auth.register(input, this.metadata(request)); this.setCookie(response, result.token); return { user: result.user };
  }

  @Post('login') @HttpCode(HttpStatus.OK) @UseGuards(AuthRateLimitGuard) @AuthRateLimit(10, 15 * 60 * 1000)
  async login(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    const result = await this.auth.login(input, this.metadata(request)); this.setCookie(response, result.token); return { user: result.user };
  }

  @Post('google') @HttpCode(HttpStatus.OK) @UseGuards(AuthRateLimitGuard) @AuthRateLimit(10, 15 * 60 * 1000)
  async google(@Body() input: GoogleLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    const result = await this.auth.loginWithGoogle(input.credential, this.metadata(request)); this.setCookie(response, result.token); return { user: result.user };
  }

  @Get('me') @UseGuards(SessionGuard)
  async me(@Req() request: AuthenticatedRequest): Promise<AuthResponseDto> {
    const user = await this.auth.getUserFromSession(this.readCookie(request.headers.cookie));
    if (!user) throw new UnauthorizedException('Authentication is required');
    return { user: await this.auth.toPublicUser(user) };
  }

  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT) @UseGuards(SessionGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(this.readCookie(request.headers.cookie));
    response.clearCookie(this.auth.cookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  }

  private setCookie(response: Response, token: string): void {
    response.cookie(this.auth.cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: this.auth.cookieMaxAgeMs(), path: '/' });
  }
  private metadata(request: Request) { const forwarded = request.headers['x-forwarded-for']; return { userAgent: request.headers['user-agent'], ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip }; }
  private readCookie(header?: string): string | undefined { if (!header) return undefined; const prefix = `${this.auth.cookieName}=`; return header.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix))?.slice(prefix.length); }
}
