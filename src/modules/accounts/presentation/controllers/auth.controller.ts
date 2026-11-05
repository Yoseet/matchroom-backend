import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service.js';
import { AuthResponseDto, GoogleLoginDto, LoginDto, RegisterDto } from '../../application/dto/auth.dto.js';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard.js';
import { SessionGuard } from '../guards/session.guard.js';
import type { AuthenticatedRequest } from '../guards/session.guard.js';
import { AuthRateLimit } from '../guards/rate-limit.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(5, 15 * 60 * 1000)
  async register(@Body() input: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    const result = await this.authService.register(input, this.metadata(request));
    this.setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 15 * 60 * 1000)
  async login(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    const result = await this.authService.login(input, this.metadata(request));
    this.setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 15 * 60 * 1000)
  async google(@Body() input: GoogleLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponseDto> {
    const result = await this.authService.loginWithGoogle(input.credential, this.metadata(request));
    this.setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() request: AuthenticatedRequest): Promise<AuthResponseDto> {
    const user = await this.authService.getUserFromSession(this.readCookie(request.headers.cookie));
    // SessionGuard has already checked this; the fallback keeps the type contract explicit.
    if (!user) throw new UnauthorizedException('Authentication is required');
    return { user: this.authService.toPublicUser(user) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(this.readCookie(request.headers.cookie));
    response.clearCookie(this.authService.cookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(this.authService.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: this.authService.cookieMaxAgeMs(),
      path: '/',
    });
  }

  private metadata(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip,
    };
  }

  private readCookie(header?: string): string | undefined {
    if (!header) return undefined;
    const prefix = `${this.authService.cookieName}=`;
    return header.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
  }
}
