import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PrivacySetting } from '../../domain/entities/index.js';

@Injectable()
export class PrivacyService {
  /**
   * Creates the default privacy settings for a new account. Called by
   * `accounts` inside the registration transaction.
   */
  async createDefaults(userId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(PrivacySetting).insert({ userId });
  }
}
