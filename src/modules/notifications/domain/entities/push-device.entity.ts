import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type PushPlatform = 'ios' | 'android';

@Entity('push_devices')
@Unique('uq_push_devices_token', ['token'])
@Check('chk_push_devices_platform', `platform IN ('ios','android')`)
@Index('idx_push_devices_user_id', ['userId'])
export class PushDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  platform: PushPlatform;

  @Column({ type: 'text' })
  token: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
