export interface AuthUser {
  userId: string;
  sessionId: string;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}
