import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '../../../../config/env.js';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../../../common/auth/interfaces/auth-user.interface.js';
import type { AuthTokensDto } from '../dto/auth-tokens.dto.js';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async issueTokens(
    userId: string,
    sessionId: string,
  ): Promise<AuthTokensDto> {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_TTL_SECONDS,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
      refreshTokenExpiresIn: env.JWT_REFRESH_TTL_SECONDS,
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
      token,
      { secret: env.JWT_REFRESH_SECRET },
    );

    if (
      payload.type !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new Error('Invalid refresh token');
    }

    return payload;
  }

  /**
   * Refresh tokens are already signed and high entropy; an HMAC with the
   * refresh secret avoids storing the bearer value itself.
   */
  hashRefreshToken(token: string): string {
    return createHmac('sha256', env.JWT_REFRESH_SECRET)
      .update(token)
      .digest('hex');
  }

  verifyRefreshTokenHash(token: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashRefreshToken(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  }

  generateOneTimeToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashOneTimeToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
