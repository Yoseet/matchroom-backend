import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { env } from '../../../../config/env.js';
import { PrivacySetting } from '../../../privacy/domain/entities/index.js';
import { ProfilesService } from '../../../profiles/application/services/profiles.service.js';
import {
  AuthIdentity,
  LegalAcceptance,
  OneTimeToken,
  User,
  UserSession,
} from '../../domain/entities/index.js';
import type {
  DeleteAccountDto,
  DeletionScheduledDto,
  LegalAcceptanceDto,
  LoginDto,
  PublicUserDto,
  RegisterDto,
} from '../dto/auth.dto.js';
import { MailService } from './mail.service.js';

const PASSWORD_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;
const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const TERMS_VERSION = '2026-01';
const PRIVACY_VERSION = '2026-01';

type GooglePayload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  readonly cookieName = env.SESSION_COOKIE_NAME;
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
    @InjectRepository(OneTimeToken) private readonly tokens: Repository<OneTimeToken>,
    @InjectRepository(LegalAcceptance) private readonly legal: Repository<LegalAcceptance>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profiles: ProfilesService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterDto, metadata: RequestMetadata): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_COST);
    const result = await this.persistRegistration(email, passwordHash, metadata);
    await this.trySendVerificationEmail(result.user.email, result.verificationToken);
    return this.createSession(result.user, metadata);
  }

  private async persistRegistration(
    email: string,
    passwordHash: string,
    metadata: RequestMetadata,
  ): Promise<{ user: User; verificationToken: string }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        if (await users.existsBy({ email })) {
          throw new ConflictException('An account with this email already exists');
        }

        const created = await users.save(users.create({ email, passwordHash }));
        await this.createAccountRows(created.id, manager);
        await this.recordLegalAcceptance(created.id, metadata, manager);
        const verificationToken = await this.createOneTimeToken(
          manager,
          created.id,
          'email_verification',
          EMAIL_TOKEN_TTL_MS,
        );
        return { user: created, verificationToken };
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(input: LoginDto, metadata: RequestMetadata): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    const user = await this.findUserWithPassword(email);
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const valid = user?.passwordHash
      ? await bcrypt.compare(input.password, user.passwordHash)
      : false;

    if (!user || !valid || user.status !== 'active' || locked) {
      if (user && !locked) {
        user.failedLoginCount += 1;
        if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
          user.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MS);
          user.failedLoginCount = 0;
        }
        await this.users.save(user);
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.users.save(user);
    await this.createAccountRows(user.id);
    return this.createSession(user, metadata);
  }

  async loginWithGoogle(
    credential: string,
    metadata: RequestMetadata,
    sessionToken?: string,
    linkPassword?: string,
  ): Promise<SessionResult> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    let payload: GooglePayload | undefined;
    try {
      payload = (
        await this.googleClient.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID,
        })
      ).getPayload() as GooglePayload | undefined;
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Invalid Google credential');
    }
    const email = this.normalizeEmail(payload.email);

    const identity = await this.identities.findOne({
      where: { provider: 'google', providerUserId: payload.sub },
    });
    if (identity) {
      const user = await this.users.findOne({ where: { id: identity.userId } });
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Unable to sign in');
      }
      user.lastLoginAt = new Date();
      await this.users.save(user);
      await this.createAccountRows(user.id);
      await this.ensureProfile(user.id, payload);
      return this.createSession(user, metadata);
    }

    const existing = await this.findUserWithPassword(email);
    if (existing) {
      if (existing.status !== 'active') {
        throw new UnauthorizedException('Unable to sign in');
      }
      const passwordMatches =
        existing.passwordHash && linkPassword
          ? await bcrypt.compare(linkPassword, existing.passwordHash)
          : false;
      const sessionUser =
        !passwordMatches && sessionToken
          ? await this.getUserFromSession(sessionToken)
          : null;
      const canLink = passwordMatches || sessionUser?.id === existing.id;
      if (!canLink) {
        throw new ConflictException(
          'An account with this email already exists. Confirm linking Google with your password or an active session.',
        );
      }

      await this.identities.save(
        this.identities.create({
          userId: existing.id,
          provider: 'google',
          providerUserId: payload.sub,
          providerEmail: email,
        }),
      );
      if (!existing.emailVerifiedAt) {
        existing.emailVerifiedAt = new Date();
        await this.users.save(existing);
      }
      existing.lastLoginAt = new Date();
      await this.users.save(existing);
      await this.createAccountRows(existing.id);
      await this.ensureProfile(existing.id, payload);
      return this.createSession(existing, metadata);
    }

    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const created = await users.save(
          users.create({ email, emailVerifiedAt: new Date() }),
        );
        await manager.getRepository(AuthIdentity).save(
          manager.getRepository(AuthIdentity).create({
            userId: created.id,
            provider: 'google',
            providerUserId: payload.sub as string,
            providerEmail: email,
          }),
        );
        await this.createAccountRows(created.id, manager);
        return created;
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Unable to link Google account');
      }
      throw error;
    }

    await this.ensureProfile(user.id, payload);
    return this.createSession(user, metadata);
  }

  async rotateSession(
    token: string | undefined,
    metadata: RequestMetadata,
  ): Promise<SessionResult> {
    if (!token) throw new UnauthorizedException('Authentication is required');

    return this.dataSource.transaction(async (manager) => {
      const sessions = manager.getRepository(UserSession);
      const session = await sessions
        .createQueryBuilder('session')
        .addSelect('session.refreshTokenHash')
        .where('session.refreshTokenHash = :hash', { hash: this.hashToken(token) })
        .andWhere('session.revokedAt IS NULL')
        .andWhere('session.expiresAt > NOW()')
        .getOne();

      if (!session) throw new UnauthorizedException('Authentication is required');

      session.revokedAt = new Date();
      session.lastUsedAt = new Date();
      await sessions.save(session);

      const user = await manager
        .getRepository(User)
        .findOne({ where: { id: session.userId, status: 'active' } });
      if (!user) throw new UnauthorizedException('Authentication is required');

      return this.createSession(user, metadata, manager);
    });
  }

  async getUserFromSession(token?: string): Promise<User | null> {
    if (!token) return null;
    const session = await this.sessions
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.refreshTokenHash = :hash', { hash: this.hashToken(token) })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > NOW()')
      .getOne();

    if (!session) return null;
    const user = await this.users.findOne({
      where: { id: session.userId, status: 'active' },
    });
    if (!user) return null;

    session.lastUsedAt = new Date();
    await this.sessions.save(session);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id, status: 'active' } });
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.sessions
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where('refresh_token_hash = :hash', { hash: this.hashToken(token) })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async verifyEmail(token: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const userId = await this.consumeOneTimeToken(
        manager,
        token,
        'email_verification',
      );
      if (!userId) {
        throw new BadRequestException('Invalid or expired verification token');
      }
      await manager
        .createQueryBuilder()
        .update(User)
        .set({ emailVerifiedAt: () => 'COALESCE(email_verified_at, now())' })
        .where('id = :userId', { userId })
        .execute();
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) throw new UnauthorizedException('Authentication is required');
    if (user.emailVerifiedAt) return;

    const token = await this.dataSource.transaction((manager) =>
      this.createOneTimeToken(
        manager,
        user.id,
        'email_verification',
        EMAIL_TOKEN_TTL_MS,
      ),
    );
    await this.mail.sendVerificationEmail(user.email, token);
  }

  /**
   * Always resolves: the response must not reveal whether the email exists.
   */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.users.findOne({
      where: { email, status: 'active' },
    });
    if (!user) return;

    try {
      const token = await this.dataSource.transaction((manager) =>
        this.createOneTimeToken(
          manager,
          user.id,
          'password_reset',
          PASSWORD_TOKEN_TTL_MS,
        ),
      );
      await this.mail.sendPasswordResetEmail(user.email, token);
    } catch (error: unknown) {
      // Never leak account existence or delivery failures to the caller.
      this.logger.warn(
        `No se pudo enviar el correo de recuperación: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_COST);
    await this.dataSource.transaction(async (manager) => {
      const userId = await this.consumeOneTimeToken(
        manager,
        token,
        'password_reset',
      );
      if (!userId) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      await manager
        .createQueryBuilder()
        .update(User)
        .set({
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          emailVerifiedAt: () => 'COALESCE(email_verified_at, now())',
        })
        .where('id = :userId', { userId })
        .execute();

      await manager
        .createQueryBuilder()
        .update(UserSession)
        .set({ revokedAt: new Date() })
        .where('user_id = :userId', { userId })
        .andWhere('revoked_at IS NULL')
        .execute();
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .andWhere('user.status = :status', { status: 'active' })
      .getOne();

    if (!user) throw new UnauthorizedException('Authentication is required');
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_COST);
    await this.users.save(user);
  }

  async acceptLegal(
    userId: string,
    input: LegalAcceptanceDto,
    metadata: RequestMetadata,
  ): Promise<void> {
    if (!input.acceptTerms || !input.adultDeclared) {
      throw new BadRequestException(
        'You must accept the terms and declare that you are at least 18 years old',
      );
    }
    await this.recordLegalAcceptance(userId, metadata);
  }

  async setActiveMode(
    userId: string,
    mode: 'seeker' | 'landlord',
  ): Promise<PublicUserDto> {
    const user = await this.getUserById(userId);
    if (!user) throw new UnauthorizedException('Authentication is required');
    if (mode === 'landlord' && !user.landlordEnabledAt) {
      throw new ForbiddenException(
        'Landlord mode is not enabled for this account',
      );
    }
    user.activeMode = mode;
    await this.users.save(user);
    return this.toPublicUser(user);
  }

  async enableLandlordMode(userId: string): Promise<PublicUserDto> {
    const user = await this.getUserById(userId);
    if (!user) throw new UnauthorizedException('Authentication is required');
    if (user.identityStatus !== 'verified' || !user.identityVerifiedAt) {
      throw new ForbiddenException(
        'Identity verification is required to enable landlord mode',
      );
    }
    if (!user.landlordEnabledAt) user.landlordEnabledAt = new Date();
    user.activeMode = 'landlord';
    await this.users.save(user);
    return this.toPublicUser(user);
  }

  async requestDeletion(
    userId: string,
    input: DeleteAccountDto,
  ): Promise<DeletionScheduledDto> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .andWhere('user.status = :status', { status: 'active' })
      .getOne();

    if (!user) throw new UnauthorizedException('Authentication is required');

    if (user.passwordHash) {
      const matches =
        input.password &&
        (await bcrypt.compare(input.password, user.passwordHash));
      if (!matches) {
        throw new UnauthorizedException('Password confirmation failed');
      }
    } else if (input.confirm !== true) {
      throw new BadRequestException(
        'Confirm the account deletion to continue',
      );
    }

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + DELETION_GRACE_MS);

    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(User)
        .set({
          status: 'pending_deletion',
          deletionRequestedAt: now,
          deletionScheduledAt: scheduledAt,
        })
        .where('id = :userId', { userId })
        .execute();

      await manager
        .createQueryBuilder()
        .update(UserSession)
        .set({ revokedAt: now })
        .where('user_id = :userId', { userId })
        .andWhere('revoked_at IS NULL')
        .execute();

      // Pause the listings, undo active matches and close the conversations
      // where the user participates.
      await manager.query(
        `UPDATE properties SET status = 'paused', updated_at = now()
         WHERE landlord_id = $1 AND status IN ('active', 'reserved')`,
        [userId],
      );
      await manager.query(
        `UPDATE matches SET status = 'unmatched', unmatched_by = $1, unmatched_at = now()
         WHERE status = 'active' AND (user_a_id = $1 OR user_b_id = $1)`,
        [userId],
      );
      await manager.query(
        `UPDATE conversations SET status = 'closed', closed_reason = 'account_deleted'
         WHERE status = 'active'
           AND id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = $1)`,
        [userId],
      );
    });

    return { scheduledAt: scheduledAt.toISOString() };
  }

  async toPublicUser(user: User): Promise<PublicUserDto> {
    await this.profiles.createEmpty(user.id);
    const profile = await this.profiles.getOwnProfile(user.id);
    return {
      id: user.id,
      email: user.email,
      activeMode: user.activeMode,
      emailVerified: Boolean(user.emailVerifiedAt),
      firstName: profile.firstName,
      lastName: profile.lastName,
    };
  }

  cookieMaxAgeMs(): number {
    return env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  cookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: env.SESSION_COOKIE_SECURE,
      sameSite: env.SESSION_COOKIE_SAME_SITE,
      path: '/',
      maxAge: this.cookieMaxAgeMs(),
    };
  }

  private async createAccountRows(
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.profiles.createEmpty(userId, manager);
    const repository = manager
      ? manager.getRepository(PrivacySetting)
      : this.dataSource.getRepository(PrivacySetting);
    if (!(await repository.existsBy({ userId }))) {
      await repository.save(repository.create({ userId }));
    }
  }

  private async recordLegalAcceptance(
    userId: string,
    metadata: RequestMetadata,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager
      ? manager.getRepository(LegalAcceptance)
      : this.legal;
    const ipAddress = metadata.ipAddress ?? null;
    await repository
      .createQueryBuilder()
      .insert()
      .values([
        {
          userId,
          documentType: 'terms',
          documentVersion: TERMS_VERSION,
          adultDeclared: true,
          ipAddress,
        },
        {
          userId,
          documentType: 'privacy',
          documentVersion: PRIVACY_VERSION,
          adultDeclared: true,
          ipAddress,
        },
      ])
      .orIgnore()
      .execute();
  }

  private async ensureProfile(
    userId: string,
    claims?: GooglePayload,
  ): Promise<void> {
    await this.profiles.createEmpty(userId);
    if (!claims?.given_name && !claims?.family_name) return;
    const profile = await this.profiles.getOwnProfile(userId);
    const patch: { firstName?: string; lastName?: string } = {};
    if (!profile.firstName && claims.given_name) {
      patch.firstName = claims.given_name;
    }
    if (!profile.lastName && claims.family_name) {
      patch.lastName = claims.family_name;
    }
    if (Object.keys(patch).length) {
      await this.profiles.updateProfile(userId, patch);
    }
  }

  private async createOneTimeToken(
    manager: EntityManager,
    userId: string,
    purpose: 'email_verification' | 'password_reset',
    ttlMs: number,
  ): Promise<string> {
    // Invalidate previous unused tokens for the same purpose.
    await manager
      .createQueryBuilder()
      .update(OneTimeToken)
      .set({ usedAt: () => 'now()' })
      .where('user_id = :userId', { userId })
      .andWhere('purpose = :purpose', { purpose })
      .andWhere('used_at IS NULL')
      .execute();

    const token = randomBytes(32).toString('base64url');
    await manager.getRepository(OneTimeToken).save(
      manager.getRepository(OneTimeToken).create({
        userId,
        purpose,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlMs),
      }),
    );
    return token;
  }

  private async consumeOneTimeToken(
    manager: EntityManager,
    token: string,
    purpose: 'email_verification' | 'password_reset',
  ): Promise<string | null> {
    // UPDATE ... RETURNING keeps the consumption atomic: two concurrent
    // requests can never use the same token. TypeORM's UpdateResult does not
    // expose the returned rows in this version, so the statement is raw SQL.
    const result = await manager.query(
      `UPDATE one_time_tokens
          SET used_at = now()
        WHERE token_hash = $1
          AND purpose = $2
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING user_id`,
      [this.hashToken(token), purpose],
    );
    // Depending on the driver/version, `query` returns the rows or
    // `[rows, affectedRows]`. Normalize both shapes.
    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as Array<{ user_id?: string }>;

    return rows[0]?.user_id ?? null;
  }

  private async createSession(
    user: User,
    metadata: RequestMetadata,
    manager?: EntityManager,
  ): Promise<SessionResult> {
    const repository = manager
      ? manager.getRepository(UserSession)
      : this.sessions;
    const token = randomBytes(48).toString('base64url');
    await repository.save(
      repository.create({
        userId: user.id,
        refreshTokenHash: this.hashToken(token),
        userAgent: metadata.userAgent?.slice(0, 500) ?? null,
        ipAddress: metadata.ipAddress ?? null,
        expiresAt: new Date(Date.now() + this.cookieMaxAgeMs()),
      }),
    );
    return { token, user: await this.toPublicUser(user) };
  }

  private async trySendVerificationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    try {
      await this.mail.sendVerificationEmail(email, token);
    } catch (error: unknown) {
      // The account is already created; a delivery failure must not turn a
      // successful registration into a 5xx. The user can request a resend.
      this.logger.warn(
        `No se pudo enviar la verificación de correo: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private findUserWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}

export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionResult {
  token: string;
  user: PublicUserDto;
}
