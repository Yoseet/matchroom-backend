import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, IsNull, QueryFailedError, type EntityManager } from 'typeorm';
import { env } from '../../../../config/env.js';
import type { RefreshTokenPayload } from '../../../../common/auth/interfaces/auth-user.interface.js';
import {
  LegalAcceptance,
  OneTimeToken,
  User,
  UserSession,
} from '../../domain/entities/index.js';
import { ProfilesService } from '../../../profiles/index.js';
import { PrivacyService } from '../../../privacy/index.js';
import type { AuthResponseDto } from '../dto/auth-response.dto.js';
import type { AuthTokensDto } from '../dto/auth-tokens.dto.js';
import { AuthUserDto } from '../dto/auth-user.dto.js';
import type { ChangePasswordDto } from '../dto/change-password.dto.js';
import type { ForgotPasswordDto } from '../dto/forgot-password.dto.js';
import type { LoginDto } from '../dto/login.dto.js';
import type { PasswordResetRequestedDto } from '../dto/password-reset-requested.dto.js';
import type { RefreshTokenDto } from '../dto/refresh-token.dto.js';
import type { RegisterDto } from '../dto/register.dto.js';
import type { ResetPasswordDto } from '../dto/reset-password.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { TokenService } from './token.service.js';

const GENERIC_RESET_MESSAGE =
  'If the email is registered, a password reset link has been sent.';

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

type LoginOutcome =
  | { kind: 'success'; user: User; tokens: AuthTokensDto }
  | { kind: 'invalid' }
  | { kind: 'locked' }
  | { kind: 'inactive' };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly profilesService: ProfilesService,
    private readonly privacyService: PrivacyService,
  ) {}

  async register(
    dto: RegisterDto,
    context: RequestContext,
  ): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(User);
        const created = await userRepository.save(
          userRepository.create({
            email: dto.email,
            passwordHash,
          }),
        );

        const user = await userRepository.findOneByOrFail({ id: created.id });

        await this.profilesService.createEmpty(user.id, manager);
        await this.privacyService.createDefaults(user.id, manager);
        await this.saveLegalAcceptances(
          manager,
          user.id,
          dto.adultDeclared,
          context.ipAddress,
        );

        const tokens = await this.createSession(user, context, manager);
        return { user, tokens };
      });

      return {
        user: this.toAuthUser(result.user),
        tokens: result.tokens,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    context: RequestContext,
  ): Promise<AuthResponseDto> {
    const outcome = await this.dataSource.transaction<LoginOutcome>(
      async (manager) => {
        const userRepository = manager.getRepository(User);
        const user = await userRepository
          .createQueryBuilder('user')
          .addSelect('user.passwordHash')
          .setLock('pessimistic_write')
          .where('user.email = :email', { email: dto.email })
          .getOne();

        if (!user || !user.passwordHash) {
          return { kind: 'invalid' };
        }

        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
          return { kind: 'locked' };
        }

        if (user.status !== 'active') {
          return { kind: 'inactive' };
        }

        const passwordMatches = await this.passwordHasher.verify(
          dto.password,
          user.passwordHash,
        );

        if (!passwordMatches) {
          user.failedLoginCount += 1;
          if (user.failedLoginCount >= env.AUTH_MAX_FAILED_ATTEMPTS) {
            user.lockedUntil = new Date(
              now.getTime() + env.AUTH_LOCK_MINUTES * 60_000,
            );
          }
          await userRepository.save(user);
          return { kind: 'invalid' };
        }

        user.failedLoginCount = 0;
        user.lockedUntil = null;
        user.lastLoginAt = now;
        await userRepository.save(user);

        const tokens = await this.createSession(user, context, manager);
        return { kind: 'success', user, tokens };
      },
    );

    switch (outcome.kind) {
      case 'success':
        return {
          user: this.toAuthUser(outcome.user),
          tokens: outcome.tokens,
        };
      case 'locked':
        throw new HttpException(
          'Account temporarily locked. Try again later.',
          HttpStatus.LOCKED,
        );
      case 'inactive':
        throw new ForbiddenException('Account is not active');
      case 'invalid':
        throw new UnauthorizedException('Invalid email or password');
    }
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(UserSession);
      const session = await sessionRepository
        .createQueryBuilder('session')
        .addSelect('session.refreshTokenHash')
        .setLock('pessimistic_write')
        .where('session.id = :sessionId', { sessionId: payload.sid })
        .getOne();

      if (
        !session ||
        session.userId !== payload.sub ||
        session.revokedAt !== null ||
        session.expiresAt <= new Date() ||
        !this.tokenService.verifyRefreshTokenHash(
          dto.refreshToken,
          session.refreshTokenHash,
        )
      ) {
        return null;
      }

      const user = await manager
        .getRepository(User)
        .findOneBy({ id: session.userId });

      if (!user || user.status !== 'active') {
        return null;
      }

      const tokens = await this.tokenService.issueTokens(
        user.id,
        session.id,
      );

      session.refreshTokenHash = this.tokenService.hashRefreshToken(
        tokens.refreshToken,
      );
      session.lastUsedAt = new Date();
      session.expiresAt = new Date(
        Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000,
      );
      await sessionRepository.save(session);

      return { user, tokens };
    });

    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return {
      user: this.toAuthUser(result.user),
      tokens: result.tokens,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.dataSource.getRepository(UserSession).update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: userId });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    return this.toAuthUser(user);
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const changed = await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const user = await userRepository
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .getOne();

      if (!user || !user.passwordHash) {
        return false;
      }

      const currentMatches = await this.passwordHasher.verify(
        dto.currentPassword,
        user.passwordHash,
      );

      if (!currentMatches) {
        return false;
      }

      user.passwordHash = await this.passwordHasher.hash(dto.newPassword);
      await userRepository.save(user);

      await manager
        .getRepository(UserSession)
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('user_id = :userId', { userId })
        .andWhere('id <> :currentSessionId', { currentSessionId })
        .andWhere('revoked_at IS NULL')
        .execute();

      return true;
    });

    if (!changed) {
      throw new BadRequestException('Current password is incorrect');
    }
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
  ): Promise<PasswordResetRequestedDto> {
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user || user.status !== 'active' || !user.passwordHash) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    const token = this.tokenService.generateOneTimeToken();
    const tokenHash = this.tokenService.hashOneTimeToken(token);

    await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(OneTimeToken);

      await tokenRepository.update(
        { userId: user.id, purpose: 'password_reset', usedAt: IsNull() },
        { usedAt: new Date() },
      );

      await tokenRepository.insert({
        userId: user.id,
        purpose: 'password_reset',
        tokenHash,
        expiresAt: new Date(
          Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000,
        ),
      });
    });

    if (env.NODE_ENV !== 'production') {
      this.logger.debug(
        `Password reset token for ${user.email}: ${token}`,
      );
    }

    return {
      message: GENERIC_RESET_MESSAGE,
      ...(env.AUTH_RETURN_RESET_TOKEN ? { resetToken: token } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.tokenService.hashOneTimeToken(dto.token);
    const passwordHash = await this.passwordHasher.hash(dto.newPassword);

    await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(OneTimeToken);
      const token = await tokenRepository
        .createQueryBuilder('token')
        .setLock('pessimistic_write')
        .where('token.token_hash = :tokenHash', { tokenHash })
        .andWhere('token.purpose = :purpose', { purpose: 'password_reset' })
        .andWhere('token.used_at IS NULL')
        .andWhere('token.expires_at > now()')
        .getOne();

      if (!token) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      token.usedAt = new Date();
      await tokenRepository.save(token);

      const userRepository = manager.getRepository(User);
      const user = await userRepository.findOneBy({ id: token.userId });

      if (!user) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      user.passwordHash = passwordHash;
      user.failedLoginCount = 0;
      user.lockedUntil = null;
      await userRepository.save(user);

      await manager
        .getRepository(UserSession)
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('user_id = :userId', { userId: user.id })
        .andWhere('revoked_at IS NULL')
        .execute();
    });
  }

  private async createSession(
    user: User,
    context: RequestContext,
    manager: EntityManager,
  ): Promise<AuthTokensDto> {
    const sessionId = randomUUID();
    const tokens = await this.tokenService.issueTokens(user.id, sessionId);

    await manager.getRepository(UserSession).insert({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.tokenService.hashRefreshToken(
        tokens.refreshToken,
      ),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt: new Date(
        Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000,
      ),
      lastUsedAt: new Date(),
    });

    return tokens;
  }

  private async saveLegalAcceptances(
    manager: EntityManager,
    userId: string,
    adultDeclared: boolean,
    ipAddress?: string | null,
  ): Promise<void> {
    const repository = manager.getRepository(LegalAcceptance);

    await repository.insert([
      {
        userId,
        documentType: 'terms',
        documentVersion: env.LEGAL_TERMS_VERSION,
        adultDeclared,
        ipAddress: ipAddress ?? null,
      },
      {
        userId,
        documentType: 'privacy',
        documentVersion: env.LEGAL_PRIVACY_VERSION,
        adultDeclared,
        ipAddress: ipAddress ?? null,
      },
    ]);
  }

  private toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      activeMode: user.activeMode,
      identityStatus: user.identityStatus,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
}
