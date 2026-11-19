import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { env } from '../../../../config/env.js';
import { ProfilesService } from '../../../profiles/application/services/profiles.service.js';
import { AuthIdentity, User, UserSession } from '../../domain/entities/index.js';
import type { LoginDto, PublicUserDto, RegisterDto } from '../dto/auth.dto.js';

const PASSWORD_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
type GooglePayload = { sub?: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string };

@Injectable()
export class AuthService {
  readonly cookieName = env.SESSION_COOKIE_NAME;
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
    private readonly profiles: ProfilesService,
  ) {}

  async register(input: RegisterDto, metadata: RequestMetadata): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    if (await this.users.findOne({ where: { email } })) throw new ConflictException('An account with this email already exists');
    const user = this.users.create({ email, passwordHash: await bcrypt.hash(input.password, PASSWORD_COST) });
    let saved: User;
    try { saved = await this.users.save(user); } catch (error: unknown) {
      if (this.isUniqueViolation(error)) throw new ConflictException('An account with this email already exists');
      throw error;
    }
    await this.profiles.createEmpty(saved.id);
    return this.createSession(saved, metadata);
  }

  async login(input: LoginDto, metadata: RequestMetadata): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    const user = await this.users.createQueryBuilder('user').addSelect('user.passwordHash').where('user.email = :email', { email }).getOne();
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const valid = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !valid || user.status !== 'active' || locked) {
      if (user && !locked) { user.failedLoginCount += 1; if (user.failedLoginCount >= MAX_FAILED_LOGINS) { user.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MS); user.failedLoginCount = 0; } await this.users.save(user); }
      throw new UnauthorizedException('Invalid email or password');
    }
    user.failedLoginCount = 0; user.lockedUntil = null; user.lastLoginAt = new Date(); await this.users.save(user);
    await this.profiles.createEmpty(user.id);
    return this.createSession(user, metadata);
  }

  async loginWithGoogle(credential: string, metadata: RequestMetadata): Promise<SessionResult> {
    if (!env.GOOGLE_CLIENT_ID) throw new ServiceUnavailableException('Google sign-in is not configured');
    let payload: GooglePayload | undefined;
    try { payload = (await this.googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID })).getPayload() as GooglePayload | undefined; }
    catch { throw new UnauthorizedException('Invalid Google credential'); }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new UnauthorizedException('Invalid Google credential');
    const email = this.normalizeEmail(payload.email);
    const identity = await this.identities.findOne({ where: { provider: 'google', providerUserId: payload.sub } });
    if (identity) {
      const user = await this.users.findOne({ where: { id: identity.userId } });
      if (!user || user.status !== 'active') throw new UnauthorizedException('Unable to sign in');
      user.lastLoginAt = new Date(); await this.users.save(user);
      await this.ensureProfile(user.id, payload);
      return this.createSession(user, metadata);
    }
    if (await this.users.findOne({ where: { email } })) throw new ConflictException('Use your existing sign-in method to link Google');
    const user = await this.users.save(this.users.create({ email, emailVerifiedAt: new Date() }));
    try { await this.identities.save(this.identities.create({ userId: user.id, provider: 'google', providerUserId: payload.sub, providerEmail: email })); }
    catch (error: unknown) { if (this.isUniqueViolation(error)) throw new ConflictException('Unable to link Google account'); throw error; }
    await this.ensureProfile(user.id, payload);
    return this.createSession(user, metadata);
  }

  async getUserFromSession(token?: string): Promise<User | null> {
    if (!token) return null;
    const session = await this.sessions.createQueryBuilder('session').addSelect('session.refreshTokenHash').where('session.refreshTokenHash = :hash', { hash: this.hashToken(token) }).andWhere('session.revokedAt IS NULL').andWhere('session.expiresAt > NOW()').getOne();
    if (!session) return null;
    const user = await this.users.findOne({ where: { id: session.userId, status: 'active' } });
    if (!user) return null;
    session.lastUsedAt = new Date(); await this.sessions.save(session);
    return user;
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.sessions.createQueryBuilder().update(UserSession).set({ revokedAt: new Date() }).where('refresh_token_hash = :hash', { hash: this.hashToken(token) }).andWhere('revoked_at IS NULL').execute();
  }

  async toPublicUser(user: User): Promise<PublicUserDto> {
    const profile = await this.profiles.getOwnProfile(user.id);
    return { id: user.id, email: user.email, activeMode: user.activeMode, firstName: profile.firstName, lastName: profile.lastName };
  }

  cookieMaxAgeMs(): number { return env.SESSION_TTL_HOURS * 60 * 60 * 1000; }

  private async ensureProfile(userId: string, claims?: GooglePayload): Promise<void> {
    await this.profiles.createEmpty(userId);
    if (!claims?.given_name && !claims?.family_name) return;
    const profile = await this.profiles.getOwnProfile(userId);
    const patch: { firstName?: string; lastName?: string } = {};
    if (!profile.firstName && claims.given_name) patch.firstName = claims.given_name;
    if (!profile.lastName && claims.family_name) patch.lastName = claims.family_name;
    if (Object.keys(patch).length) await this.profiles.updateProfile(userId, patch);
  }

  private async createSession(user: User, metadata: RequestMetadata): Promise<SessionResult> {
    const token = randomBytes(48).toString('base64url');
    await this.sessions.save(this.sessions.create({ userId: user.id, refreshTokenHash: this.hashToken(token), userAgent: metadata.userAgent?.slice(0, 500) ?? null, ipAddress: metadata.ipAddress ?? null, expiresAt: new Date(Date.now() + this.cookieMaxAgeMs()) }));
    return { token, user: await this.toPublicUser(user) };
  }

  private normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  private isUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'; }
}

export interface RequestMetadata { userAgent?: string; ipAddress?: string }
export interface SessionResult { token: string; user: PublicUserDto }
