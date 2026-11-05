import {
  Check,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('user_blocks')
@Check('chk_user_blocks_not_self', 'blocker_id <> blocked_id')
@Index('idx_user_blocks_blocked', ['blockedId'])
export class UserBlock {
  @PrimaryColumn({ type: 'uuid' })
  blockerId: string;

  @PrimaryColumn({ type: 'uuid' })
  blockedId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
