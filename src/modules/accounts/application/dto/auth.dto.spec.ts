import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './auth.dto.js';

describe('RegisterDto', () => {
  it('accepts a valid email and password with letters and numbers', async () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'user@example.com',
      password: 'password1',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['short1', 'onlyletters', '12345678'])('rejects an invalid password: %s', async (password) => {
    const dto = Object.assign(new RegisterDto(), { email: 'user@example.com', password });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
