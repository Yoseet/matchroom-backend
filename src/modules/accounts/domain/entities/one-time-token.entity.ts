import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type OneTimeTokenPurpose = 'email_verification' | 'password_reset';

@Entity('one_time_tokens')
@Unique('uq_one_time_tokens_token_hash', ['tokenHash'])
@Index('idx_one_time_tokens_user_purpose', ['userId', 'purpose'])
@Check(
  'chk_one_time_tokens_purpose',
  `purpose IN ('email_verification','password_reset')`,
)
export class OneTimeToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  purpose: OneTimeTokenPurpose;

  @Column({ type: 'text', select: false })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
