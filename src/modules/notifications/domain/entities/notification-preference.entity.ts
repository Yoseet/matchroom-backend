import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import type { NotificationKind } from './notification.entity.js';

export type NotificationChannel = 'in_app' | 'push' | 'email';

@Entity('notification_preferences')
@Check(
  'chk_notification_preferences_kind',
  `notification_kind IN ('new_match','new_message','property_status','property_expiring','identity_result')`,
)
@Check(
  'chk_notification_preferences_channel',
  `channel IN ('in_app','push','email')`,
)
export class NotificationPreference {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  notificationKind: NotificationKind;

  @PrimaryColumn({ type: 'text' })
  channel: NotificationChannel;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}
