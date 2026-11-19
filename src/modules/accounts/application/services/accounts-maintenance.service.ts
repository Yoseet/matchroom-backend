import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { User } from '../../domain/entities/index.js';

/**
 * Final step of the 30-day account deletion window.
 *
 * The interactive endpoints only schedule the deletion (status
 * `pending_deletion`). This service anonymizes every account whose grace
 * period has expired, so personal data is no longer recoverable.
 *
 * It is intentionally independent from Nest so the CLI script can reuse it:
 * `npm run accounts:purge`.
 */
export async function purgeExpiredDeletions(
  dataSource: DataSource,
): Promise<number> {
  const logger = new Logger('AccountDeletionPurge');
  const users = await dataSource.getRepository(User).find({
    where: {
      status: 'pending_deletion',
      deletionScheduledAt: LessThanOrEqual(new Date()),
    },
    select: ['id'],
  });

  for (const user of users) {
    await dataSource.transaction(async (manager) => {
      const anonymousEmail = `deleted-${user.id}@deleted.matchroom.invalid`;

      await manager.query(
        `UPDATE users SET
           email = $2,
           email_verified_at = NULL,
           password_hash = NULL,
           status = 'deleted',
           active_mode = 'seeker',
           landlord_enabled_at = NULL,
           identity_status = 'not_started',
           identity_verified_at = NULL,
           failed_login_count = 0,
           locked_until = NULL,
           last_login_at = NULL,
           deletion_requested_at = NULL,
           deletion_scheduled_at = NULL,
           updated_at = now()
         WHERE id = $1`,
        [user.id, anonymousEmail],
      );

      await manager.query(
        'DELETE FROM auth_identities WHERE user_id = $1',
        [user.id],
      );
      await manager.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [user.id],
      );
      await manager.query(
        'DELETE FROM one_time_tokens WHERE user_id = $1',
        [user.id],
      );

      await manager.query(
        `UPDATE profiles SET
           first_name = NULL,
           last_name = NULL,
           birth_date = NULL,
           gender = NULL,
           bio = NULL,
           occupation = NULL,
           contact_phone = NULL,
           photo_asset_id = NULL,
           city_id = NULL,
           completeness_pct = 0,
           updated_at = now()
         WHERE user_id = $1`,
        [user.id],
      );

      await manager.query(
        `UPDATE privacy_settings SET
           profile_visibility = 'matches_only',
           show_exact_age = false,
           show_occupation = false,
           show_photo = false,
           appear_in_search = false,
           show_housing_preferences = false,
           show_property_interest = false,
           updated_at = now()
         WHERE user_id = $1`,
        [user.id],
      );

      await manager.query(
        `UPDATE properties SET status = 'deleted', deleted_at = COALESCE(deleted_at, now()), updated_at = now()
         WHERE landlord_id = $1 AND status <> 'deleted'`,
        [user.id],
      );
    });

    logger.log(`Cuenta ${user.id} anonimizada tras el periodo de gracia.`);
  }

  return users.length;
}

@Injectable()
export class AccountsMaintenanceService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  purgeExpiredDeletions(): Promise<number> {
    return purgeExpiredDeletions(this.dataSource);
  }
}
