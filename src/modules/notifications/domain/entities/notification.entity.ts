import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationKind =
  | 'new_match'
  | 'new_message'
  | 'property_status'
  | 'property_expiring'
  | 'identity_result';

@Entity('notifications')
@Check(
  'chk_notifications_kind',
  `kind IN ('new_match','new_message','property_status','property_expiring','identity_result')`,
)
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
@Index('idx_notifications_user_unread', ['userId'], {
  where: `"read_at" IS NULL`,
})
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  kind: NotificationKind;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  data: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
