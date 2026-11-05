import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

function repository() {
  return {
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => Object.assign(value, {
      id: value.id ?? 'user-1',
      activeMode: value.activeMode ?? 'seeker',
      status: value.status ?? 'active',
    })),
    createQueryBuilder: vi.fn(),
  };
}

describe('AuthService', () => {
  it('hashes a registration password and stores only the hash', async () => {
    const users = repository();
    const identities = repository();
    const sessions = repository();
    const service = new AuthService(users as never, identities as never, sessions as never);

    await service.register(
      { email: '  USER@Example.COM ', password: 'password1' },
      { userAgent: 'test', ipAddress: '127.0.0.1' },
    );

    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'user@example.com' }));
    const created = users.create.mock.calls[0][0];
    expect(created.passwordHash).not.toBe('password1');
    expect(await bcrypt.compare('password1', created.passwordHash)).toBe(true);
    expect(sessions.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('rejects duplicate registration before creating a password hash', async () => {
    const users = repository();
    users.findOne.mockResolvedValue({ id: 'existing-user' });
    const service = new AuthService(users as never, repository() as never, repository() as never);

    await expect(service.register(
      { email: 'user@example.com', password: 'password1' },
      {},
    )).rejects.toMatchObject({ status: 409 });
    expect(users.create).not.toHaveBeenCalled();
  });
});
