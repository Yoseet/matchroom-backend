import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

function repository(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    existsBy: vi.fn().mockResolvedValue(false),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({
      ...value,
      id: value.id ?? 'user-1',
      activeMode: value.activeMode ?? 'seeker',
      status: value.status ?? 'active',
    })),
    createQueryBuilder: vi.fn(),
    ...overrides,
  };
}

function chain(result: unknown = {}) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    'update',
    'set',
    'where',
    'andWhere',
    'insert',
    'values',
    'orIgnore',
    'returning',
    'addSelect',
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.execute = vi.fn(async () => result);
  builder.getOne = vi.fn(async () => null);
  return builder;
}

function serviceWith(options: {
  users?: ReturnType<typeof repository>;
  sessions?: ReturnType<typeof repository>;
  tokens?: ReturnType<typeof repository>;
  legal?: ReturnType<typeof repository>;
  privacy?: ReturnType<typeof repository>;
  profiles?: Record<string, unknown>;
  mail?: Record<string, unknown>;
  managerBuilder?: ReturnType<typeof chain>;
} = {}) {
  const users = options.users ?? repository();
  const sessions = options.sessions ?? repository();
  const tokens = options.tokens ?? repository();
  const legal = options.legal ?? repository({ createQueryBuilder: vi.fn(() => chain()) });
  const privacy = options.privacy ?? repository();
  const profiles = options.profiles ?? {
    createEmpty: vi.fn(),
    getOwnProfile: vi.fn().mockResolvedValue({ firstName: null, lastName: null }),
    updateProfile: vi.fn(),
  };
  const mail = options.mail ?? {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  };
  const managerBuilder = options.managerBuilder ?? chain();

  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      const name = (entity as { name?: string }).name;
      if (name === 'PrivacySetting') return privacy;
      if (name === 'LegalAcceptance') return legal;
      if (name === 'OneTimeToken') return tokens;
      return users;
    }),
    createQueryBuilder: vi.fn(() => managerBuilder),
  };
  const dataSource = {
    transaction: vi.fn(async (callback: (value: unknown) => unknown) =>
      callback(manager),
    ),
    getRepository: vi.fn(() => privacy),
  };

  const service = new AuthService(
    users as never,
    repository() as never,
    sessions as never,
    tokens as never,
    legal as never,
    dataSource as never,
    profiles as never,
    mail as never,
  );

  return { service, users, sessions, tokens, legal, privacy, profiles, mail, dataSource };
}

describe('AuthService', () => {
  it('stores only a bcrypt hash and creates the account rows in one transaction', async () => {
    const { service, users, sessions, profiles, mail, dataSource } =
      serviceWith();

    await service.register(
      {
        email: ' USER@example.com ',
        password: 'password1',
        acceptTerms: true,
        adultDeclared: true,
      },
      {},
    );

    const created = users.create.mock.calls[0][0];
    expect(created.email).toBe('user@example.com');
    expect(created.passwordHash).not.toBe('password1');
    expect(await bcrypt.compare('password1', created.passwordHash)).toBe(true);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(profiles.createEmpty).toHaveBeenCalledWith('user-1', expect.anything());
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
    );
    expect(sessions.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('rejects a duplicate email before creating the account', async () => {
    const users = repository({ existsBy: vi.fn().mockResolvedValue(true) });
    const { service, sessions } = serviceWith({ users });

    await expect(
      service.register(
        {
          email: 'user@example.com',
          password: 'password1',
          acceptTerms: true,
          adultDeclared: true,
        },
        {},
      ),
    ).rejects.toThrow(/already exists/);
    expect(sessions.save).not.toHaveBeenCalled();
  });

  it('returns only the safe identity fields, including names from the profile', async () => {
    const { service } = serviceWith({
      profiles: {
        createEmpty: vi.fn(),
        getOwnProfile: vi
          .fn()
          .mockResolvedValue({ firstName: 'Ana', lastName: 'López' }),
      },
    });

    await expect(
      service.toPublicUser({
        id: 'user-1',
        email: 'ana@example.com',
        activeMode: 'seeker',
        emailVerifiedAt: null,
      } as never),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      activeMode: 'seeker',
      emailVerified: false,
      firstName: 'Ana',
      lastName: 'López',
    });
  });

  it('increments failed attempts and locks the account after five failures', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('correct-password1', 4),
      status: 'active',
      failedLoginCount: 4,
      lockedUntil: null,
    };
    const users = repository({
      createQueryBuilder: vi.fn(() => {
        const builder = chain();
        builder.getOne = vi.fn().mockResolvedValue(user);
        return builder;
      }),
    });
    const { service } = serviceWith({ users });

    await expect(
      service.login(
        { email: 'user@example.com', password: 'wrong-password1' },
        {},
      ),
    ).rejects.toThrow(/Invalid email or password/);
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeInstanceOf(Date);
    expect(users.save).toHaveBeenCalled();
  });

  it('does not enable landlord mode without a verified identity', async () => {
    const users = repository({
      findOne: vi.fn().mockResolvedValue({
        id: 'user-1',
        status: 'active',
        identityStatus: 'not_started',
        identityVerifiedAt: null,
        landlordEnabledAt: null,
      }),
    });
    const { service } = serviceWith({ users });

    await expect(service.enableLandlordMode('user-1')).rejects.toThrow(
      /Identity verification/,
    );
  });
});
