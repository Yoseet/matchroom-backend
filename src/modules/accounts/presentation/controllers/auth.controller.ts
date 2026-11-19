import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AuthResponseDto,
  ChangePasswordDto,
  DeleteAccountDto,
  DeletionScheduledDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LegalAcceptanceDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateModeDto,
  VerifyEmailDto,
} from '../../application/dto/auth.dto.js';
import { AuthService } from '../../application/services/auth.service.js';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard.js';
import { AuthRateLimit } from '../guards/rate-limit.decorator.js';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../guards/session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(5, 15 * 60 * 1000)
  async register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.register(input, this.metadata(request));
    this.setCookie(response, result.token);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 15 * 60 * 1000)
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.login(input, this.metadata(request));
    this.setCookie(response, result.token);
    return { user: result.user };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 15 * 60 * 1000)
  async google(
    @Body() input: GoogleLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.loginWithGoogle(
      input.credential,
      this.metadata(request),
      this.readCookie(request.headers.cookie),
      input.linkPassword,
    );
    this.setCookie(response, result.token);
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.rotateSession(
      this.readCookie(request.headers.cookie),
      this.metadata(request),
    );
    this.setCookie(response, result.token);
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() request: AuthenticatedRequest): Promise<AuthResponseDto> {
    const user = await this.auth.getUserById(
      request.authenticatedUserId as string,
    );
    if (!user) throw new UnauthorizedException('Authentication is required');
    return { user: await this.auth.toPublicUser(user) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.readCookie(request.headers.cookie));
    response.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(request.authenticatedUserId as string);
    response.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 15 * 60 * 1000)
  async verifyEmail(@Body() input: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(input.token);
  }

  @Post('email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, AuthRateLimitGuard)
  @AuthRateLimit(3, 15 * 60 * 1000)
  async resendVerification(
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.resendVerification(request.authenticatedUserId as string);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(5, 15 * 60 * 1000)
  async forgotPassword(@Body() input: ForgotPasswordDto): Promise<void> {
    await this.auth.requestPasswordReset(input.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit(10, 15 * 60 * 1000)
  async resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(input.token, input.newPassword);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, AuthRateLimitGuard)
  @AuthRateLimit(5, 15 * 60 * 1000)
  async changePassword(
    @Body() input: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.changePassword(
      request.authenticatedUserId as string,
      input.currentPassword,
      input.newPassword,
    );
  }

  @Post('legal/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  async acceptLegal(
    @Body() input: LegalAcceptanceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.acceptLegal(
      request.authenticatedUserId as string,
      input,
      this.metadata(request),
    );
  }

  @Patch('me/mode')
  @UseGuards(SessionGuard)
  async updateMode(
    @Body() input: UpdateModeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthResponseDto> {
    return {
      user: await this.auth.setActiveMode(
        request.authenticatedUserId as string,
        input.mode,
      ),
    };
  }

  @Post('me/landlord')
  @UseGuards(SessionGuard)
  async enableLandlord(
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthResponseDto> {
    return {
      user: await this.auth.enableLandlordMode(
        request.authenticatedUserId as string,
      ),
    };
  }

  @Delete('me')
  @UseGuards(SessionGuard)
  async deleteAccount(
    @Body() input: DeleteAccountDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeletionScheduledDto> {
    const result = await this.auth.requestDeletion(
      request.authenticatedUserId as string,
      input,
    );
    response.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
    return result;
  }

  private setCookie(response: Response, token: string): void {
    response.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
  }

  private metadata(request: Request): {
    userAgent?: string;
    ipAddress?: string;
  } {
    const forwarded = request.headers['x-forwarded-for'];
    return {
      userAgent: request.headers['user-agent'],
      ipAddress:
        typeof forwarded === 'string'
          ? forwarded.split(',')[0].trim()
          : request.ip,
    };
  }

  private readCookie(header?: string): string | undefined {
    if (!header) return undefined;
    const prefix = `${this.auth.cookieName}=`;
    return header
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length);
  }
}
