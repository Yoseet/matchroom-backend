import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Profile } from '../../domain/entities/index.js';

@Injectable()
export class ProfilesService {
  /**
   * Creates the empty profile that every account owns. Called by `accounts`
   * inside the registration transaction.
   */
  async createEmpty(userId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(Profile).insert({ userId });
  }
}
