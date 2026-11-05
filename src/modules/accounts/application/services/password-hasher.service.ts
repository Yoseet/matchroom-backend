import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

const SALT_ROUNDS = 12;

@Injectable()
export class PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, SALT_ROUNDS);
  }

  verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return compare(plainPassword, passwordHash);
  }
}
