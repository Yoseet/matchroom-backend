import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { env } from '../../../../config/env.js';
import { AuthIdentity, User, UserSession } from '../../domain/entities/index.js';
import type { LoginDto, PublicUserDto, RegisterDto } from '../dto/auth.dto.js';

const PASSWORD_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  readonly cookieName = env.SESSION_COOKIE_NAME;
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
  ) {}

  async register(input: RegisterDto, metadata: RequestMetadata): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = this.users.create({
      email,
      passwordHash: await bcrypt.hash(input.password, PASSWORD_COST),
    });
    try {
      await this.users.save(user);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) throw new ConflictException('An account with this email already exists');
      throw error;
    }
    return this.createSession(user, metadata);
  }

  async login(input: LoginDto, metadata: RequestMetadata): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const valid = user?.passwordHash
      ? await bcrypt.compare(input.password, user.passwordHash)
      : false;
    if (!user || !valid || user.status !== 'active' || isLocked) {
      if (user && !isLocked) {
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
    return this.createSession(user, metadata);
  }

  async loginWithGoogle(credential: string, metadata: RequestMetadata): Promise<SessionResult> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    let payload: { sub?: string; email?: string; email_verified?: boolean } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Invalid Google credential');
    }
    const providerUserId = payload.sub;
    const email = this.normalizeEmail(payload.email);
    const identity = await this.identities.findOne({ where: { provider: 'google', providerUserId } });

    if (identity) {
      const user = await this.users.findOne({ where: { id: identity.userId } });
      if (!user || user.status !== 'active') throw new UnauthorizedException('Unable to sign in');
      user.lastLoginAt = new Date();
      await this.users.save(user);
      return this.createSession(user, metadata);
    }

    // A matching email is not proof that the current Google identity owns an existing account.
    if (await this.users.findOne({ where: { email } })) {
      throw new ConflictException('Use your existing sign-in method to link Google');
    }

    const user = await this.users.save(this.users.create({ email, emailVerifiedAt: new Date() }));
    try {
      await this.identities.save(this.identities.create({
        userId: user.id,
        provider: 'google',
        providerUserId,
        providerEmail: email,
      }));
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Unable to link Google account');
      throw error;
    }
    return this.createSession(user, metadata);
  }

  async getUserFromSession(token?: string): Promise<User | null> {
    if (!token) return null;
    const hash = this.hashToken(token);
    const session = await this.sessions
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.refreshTokenHash = :hash', { hash })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > NOW()')
      .getOne();
    if (!session) return null;

    const user = await this.users.findOne({ where: { id: session.userId, status: 'active' } });
    if (!user) return null;
    session.lastUsedAt = new Date();
    await this.sessions.save(session);
    return user;
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

  toPublicUser(user: User): PublicUserDto {
    return { id: user.id, email: user.email, activeMode: user.activeMode };
  }

  cookieMaxAgeMs(): number {
    return env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  private async createSession(user: User, metadata: RequestMetadata): Promise<SessionResult> {
    const token = randomBytes(48).toString('base64url');
    await this.sessions.save(this.sessions.create({
      userId: user.id,
      refreshTokenHash: this.hashToken(token),
      userAgent: metadata.userAgent?.slice(0, 500) ?? null,
      ipAddress: metadata.ipAddress ?? null,
      expiresAt: new Date(Date.now() + this.cookieMaxAgeMs()),
    }));
    return { token, user: this.toPublicUser(user) };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
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
