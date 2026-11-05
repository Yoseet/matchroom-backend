import type { DataSource, EntityManager } from 'typeorm';
import { env } from '../../../config/env.js';
import {
  LegalAcceptance,
  User,
} from '../../../modules/accounts/domain/entities/index.js';
import { PasswordHasher } from '../../../modules/accounts/application/services/password-hasher.service.js';
import { PrivacySetting } from '../../../modules/privacy/domain/entities/index.js';
import { Profile } from '../../../modules/profiles/domain/entities/index.js';
import {
  TEST_ACCOUNTS,
  type TestAccountSeed,
} from './seed-data.js';

export interface TestAccountsSeedResult {
  created: number;
  existing: number;
}

const passwordHasher = new PasswordHasher();

/**
 * Idempotent test-account seeder.
 *
 * It refuses to run in production because it creates accounts with a known
 * password. Every account gets its profile, default privacy settings and the
 * current legal acceptances so it can exercise the authenticated flows.
 */
export async function seedTestAccounts(
  dataSource: DataSource,
  accounts: readonly TestAccountSeed[] = TEST_ACCOUNTS,
): Promise<TestAccountsSeedResult> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Test seeders must not run in production');
  }

  return dataSource.transaction(async (manager) => {
    let created = 0;
    let existing = 0;

    for (const account of accounts) {
      const userRepository = manager.getRepository(User);
      let user = await userRepository.findOneBy({ email: account.email });

      if (!user) {
        const passwordHash = await passwordHasher.hash(account.password);
        user = await userRepository.save(
          userRepository.create({
            email: account.email,
            passwordHash,
            emailVerifiedAt: new Date(),
            activeMode: account.activeMode,
            ...(account.activeMode === 'landlord'
              ? {
                  landlordEnabledAt: new Date(),
                  identityStatus: 'verified',
                  identityVerifiedAt: new Date(),
                }
              : {}),
          }),
        );
        created += 1;
      } else {
        existing += 1;
      }

      await ensureProfile(manager, user.id, account);
      await ensurePrivacySettings(manager, user.id);
      await ensureLegalAcceptances(manager, user.id);
    }

    return { created, existing };
  });
}

async function ensureProfile(
  manager: EntityManager,
  userId: string,
  account: TestAccountSeed,
): Promise<void> {
  await manager
    .getRepository(Profile)
    .createQueryBuilder()
    .insert()
    .values({
      userId,
      firstName: account.firstName,
      lastName: account.lastName,
      birthDate: account.birthDate,
      lookingFor: account.lookingFor,
    })
    .orIgnore()
    .execute();
}

async function ensurePrivacySettings(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  await manager
    .getRepository(PrivacySetting)
    .createQueryBuilder()
    .insert()
    .values({ userId })
    .orIgnore()
    .execute();
}

async function ensureLegalAcceptances(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  const repository = manager.getRepository(LegalAcceptance);

  for (const [documentType, documentVersion] of [
    ['terms', env.LEGAL_TERMS_VERSION],
    ['privacy', env.LEGAL_PRIVACY_VERSION],
  ] as const) {
    await repository
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        documentType,
        documentVersion,
        adultDeclared: true,
      })
      .orIgnore()
      .execute();
  }
}
