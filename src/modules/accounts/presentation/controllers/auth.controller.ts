import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Public } from '../../../../common/auth/index.js';
import type { AuthUser } from '../../../../common/auth/index.js';
import { AuthResponseDto } from '../../application/dto/auth-response.dto.js';
import { AuthUserDto } from '../../application/dto/auth-user.dto.js';
import { ChangePasswordDto } from '../../application/dto/change-password.dto.js';
import { ForgotPasswordDto } from '../../application/dto/forgot-password.dto.js';
import { LoginDto } from '../../application/dto/login.dto.js';
import { PasswordResetRequestedDto } from '../../application/dto/password-reset-requested.dto.js';
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto.js';
import { RegisterDto } from '../../application/dto/register.dto.js';
import { ResetPasswordDto } from '../../application/dto/reset-password.dto.js';
import {
  AuthService,
  type RequestContext,
} from '../../application/services/auth.service.js';

function buildContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.headers['user-agent'] ?? null,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registra una cuenta con correo y contraseña',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos o términos no aceptados' })
  @ApiConflictResponse({ description: 'El correo ya está registrado' })
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.register(dto, buildContext(request));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión con correo y contraseña' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiResponse({
    status: HttpStatus.LOCKED,
    description: 'Cuenta bloqueada temporalmente por intentos fallidos',
  })
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, buildContext(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rota el refresh token y emite nuevos tokens',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido o expirado' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cierra la sesión actual' })
  @ApiNoContentResponse({ description: 'Sesión revocada' })
  @ApiUnauthorizedResponse({ description: 'Access token inválido' })
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.authService.logout(user.sessionId);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Devuelve la cuenta autenticada' })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'Access token inválido' })
  getMe(@CurrentUser() user: AuthUser): Promise<AuthUserDto> {
    return this.authService.getMe(user.userId);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cambia la contraseña de la cuenta autenticada',
  })
  @ApiNoContentResponse({ description: 'Contraseña actualizada' })
  @ApiBadRequestResponse({ description: 'Contraseña actual incorrecta' })
  @ApiUnauthorizedResponse({ description: 'Access token inválido' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(
      user.userId,
      user.sessionId,
      dto,
    );
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Solicita un enlace de recuperación de contraseña',
  })
  @ApiAcceptedResponse({ type: PasswordResetRequestedDto })
  requestPasswordReset(
    @Body() dto: ForgotPasswordDto,
  ): Promise<PasswordResetRequestedDto> {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Restablece la contraseña con un token de un solo uso',
  })
  @ApiNoContentResponse({ description: 'Contraseña restablecida' })
  @ApiBadRequestResponse({ description: 'Token inválido o expirado' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }
}
