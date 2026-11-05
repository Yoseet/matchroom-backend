import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

const PASSWORD = 'Password123';
const NEW_PASSWORD = 'ChangedPassword123';
const RESET_PASSWORD = 'ResetPassword123';
const RUN_ID = randomUUID().slice(0, 8);

interface AuthResponse {
  user: {
    id: string;
    email: string;
    status: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

describe('Accounts auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdEmails = new Set<string>();

  let mainEmail: string;
  let main: AuthResponse;
  let currentPassword = PASSWORD;

  function uniqueEmail(name: string): string {
    const email = `e2e-auth-${RUN_ID}-${name}@example.com`;
    createdEmails.add(email);
    return email;
  }

  async function register(
    name: string,
    password = PASSWORD,
  ): Promise<{ email: string; response: request.Response }> {
    const email = uniqueEmail(name);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        acceptedTerms: true,
        adultDeclared: true,
      });
    return { email, response };
  }

  async function login(
    email: string,
    password: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);

    const { email, response } = await register('main');
    mainEmail = email;
    expect(response.status).toBe(201);
    main = response.body as AuthResponse;
  });

  afterAll(async () => {
    if (createdEmails.size > 0) {
      await dataSource.query(
        `DELETE FROM users WHERE email = ANY($1::citext[])`,
        [[...createdEmails]],
      );
    }
    await app.close();
  });

  it('registers an account and returns tokens without sensitive fields', () => {
    expect(main.user.email).toBe(mainEmail);
    expect(main.tokens.accessToken).toBeTruthy();
    expect(main.tokens.refreshToken).toBeTruthy();
    expect(JSON.stringify(main)).not.toContain('passwordHash');
    expect(JSON.stringify(main)).not.toContain('password_hash');
  });

  it('creates profile, privacy settings and both legal acceptances', async () => {
    const profiles: unknown[] = await dataSource.query(
      'SELECT user_id FROM profiles WHERE user_id = $1',
      [main.user.id],
    );
    const privacy: unknown[] = await dataSource.query(
      'SELECT user_id FROM privacy_settings WHERE user_id = $1',
      [main.user.id],
    );
    const legal: Array<{ document_type: string }> = await dataSource.query(
      'SELECT document_type FROM legal_acceptances WHERE user_id = $1 ORDER BY document_type',
      [main.user.id],
    );
    const [user]: Array<{ password_hash: string }> = await dataSource.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [main.user.id],
    );

    expect(profiles).toHaveLength(1);
    expect(privacy).toHaveLength(1);
    expect(legal.map((row) => row.document_type)).toEqual([
      'privacy',
      'terms',
    ]);
    expect(user.password_hash).not.toBe(PASSWORD);
    expect(user.password_hash.startsWith('$2')).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const response = await register('duplicate');
    // Registering the same email twice uses the already registered mainEmail.
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: mainEmail,
        password: PASSWORD,
        acceptedTerms: true,
        adultDeclared: true,
      });

    expect(response.response.status).toBe(201);
    expect(duplicate.status).toBe(409);
  });

  it('rejects a password without letters and numbers', async () => {
    const { response } = await register('weak', 'onlyletters');
    expect(response.status).toBe(400);
  });

  it('rejects terms or adult declaration when false', async () => {
    const email = uniqueEmail('terms');
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        acceptedTerms: false,
        adultDeclared: true,
      });

    expect(response.status).toBe(400);
  });

  it('logs in, rejects a wrong password and returns the current user', async () => {
    const wrong = await login(mainEmail, 'WrongPassword123');
    expect(wrong.status).toBe(401);

    const success = await login(mainEmail, currentPassword);
    expect(success.status).toBe(200);
    main = success.body as AuthResponse;

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${main.tokens.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(main.user.id);
    expect(me.body.email).toBe(mainEmail);
  });

  it('rotates refresh tokens and rejects reuse of the old token', async () => {
    const oldRefreshToken = main.tokens.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(refreshed.status).toBe(200);
    main = refreshed.body as AuthResponse;
    expect(main.tokens.refreshToken).not.toBe(oldRefreshToken);

    const reused = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(reused.status).toBe(401);
  });

  it('changes the password and rejects the previous one', async () => {
    const changed = await request(app.getHttpServer())
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${main.tokens.accessToken}`)
      .send({
        currentPassword,
        newPassword: NEW_PASSWORD,
      });

    expect(changed.status).toBe(204);

    const oldLogin = await login(mainEmail, currentPassword);
    expect(oldLogin.status).toBe(401);

    const newLogin = await login(mainEmail, NEW_PASSWORD);
    expect(newLogin.status).toBe(200);

    main = newLogin.body as AuthResponse;
    currentPassword = NEW_PASSWORD;
  });

  it('resets the password with a one-time token', async () => {
    const requested = await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({ email: mainEmail });

    expect(requested.status).toBe(202);
    expect(requested.body.resetToken).toBeTruthy();

    const reset = await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({
        token: requested.body.resetToken,
        newPassword: RESET_PASSWORD,
      });

    expect(reset.status).toBe(204);

    const oldLogin = await login(mainEmail, currentPassword);
    expect(oldLogin.status).toBe(401);

    const newLogin = await login(mainEmail, RESET_PASSWORD);
    expect(newLogin.status).toBe(200);

    const reusedToken = await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({
        token: requested.body.resetToken,
        newPassword: 'AnotherPassword123',
      });

    expect(reusedToken.status).toBe(400);
    main = newLogin.body as AuthResponse;
    currentPassword = RESET_PASSWORD;
  });

  it('logs out the current session and invalidates its tokens', async () => {
    const previousAccessToken = main.tokens.accessToken;

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${previousAccessToken}`);

    expect(logout.status).toBe(204);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: main.tokens.refreshToken });

    expect(refresh.status).toBe(401);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${previousAccessToken}`);

    expect(me.status).toBe(401);
  });

  it('locks the account after five failed attempts', async () => {
    const { email, response } = await register('locked');
    expect(response.status).toBe(201);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = await login(email, 'WrongPassword123');
      expect(failed.status).toBe(401);
    }

    const locked = await login(email, PASSWORD);
    expect(locked.status).toBe(423);
  });

  it('requires authentication on protected routes', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/auth/me',
    );
    expect(response.status).toBe(401);
  });
});
