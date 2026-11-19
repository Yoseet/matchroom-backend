import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

function repository() {
  return {
    findOne: vi.fn(), create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ ...value, id: value.id ?? 'user-1', activeMode: value.activeMode ?? 'seeker', status: value.status ?? 'active' })),
    createQueryBuilder: vi.fn(),
  };
}

describe('AuthService', () => {
  it('stores only a bcrypt hash and creates the matching empty profile', async () => {
    const users = repository(); const sessions = repository();
    const profiles = { createEmpty: vi.fn(), getOwnProfile: vi.fn().mockResolvedValue({ firstName: null, lastName: null }), updateProfile: vi.fn() };
    const service = new AuthService(users as never, repository() as never, sessions as never, profiles as never);

    await service.register({ email: ' USER@example.com ', password: 'password1' }, {});

    const created = users.create.mock.calls[0][0];
    expect(created.email).toBe('user@example.com');
    expect(created.passwordHash).not.toBe('password1');
    expect(await bcrypt.compare('password1', created.passwordHash)).toBe(true);
    expect(profiles.createEmpty).toHaveBeenCalledWith('user-1');
    expect(sessions.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('returns only the safe identity fields, including names from the profile', async () => {
    const profiles = { getOwnProfile: vi.fn().mockResolvedValue({ firstName: 'Ana', lastName: 'López' }) };
    const service = new AuthService(repository() as never, repository() as never, repository() as never, profiles as never);
    await expect(service.toPublicUser({ id: 'user-1', email: 'ana@example.com', activeMode: 'seeker' } as never)).resolves.toEqual({ id: 'user-1', email: 'ana@example.com', activeMode: 'seeker', firstName: 'Ana', lastName: 'López' });
  });
});
