import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type UserStatus =
  | 'active'
  | 'pending_deletion'
  | 'suspended'
  | 'deleted';

export type UserActiveMode = 'seeker' | 'landlord';

export type IdentityStatus =
  | 'not_started'
  | 'in_progress'
  | 'verified'
  | 'rejected'
  | 'manual_review';

@Entity('users')
@Unique('uq_users_email', ['email'])
@Check(
  'chk_users_status',
  `status IN ('active','pending_deletion','suspended','deleted')`,
)
@Check('chk_users_active_mode', `active_mode IN ('seeker','landlord')`)
@Check(
  'chk_users_identity_status',
  `identity_status IN ('not_started','in_progress','verified','rejected','manual_review')`,
)
@Check('chk_users_failed_login_count', 'failed_login_count >= 0')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'citext' })
  email: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'text', nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'text', default: 'active' })
  status: UserStatus;

  @Column({ type: 'text', default: 'seeker' })
  activeMode: UserActiveMode;

  @Column({ type: 'timestamptz', nullable: true })
  landlordEnabledAt: Date | null;

  @Column({ type: 'text', default: 'not_started' })
  identityStatus: IdentityStatus;

  @Column({ type: 'timestamptz', nullable: true })
  identityVerifiedAt: Date | null;

  @Column({ type: 'smallint', default: 0 })
  failedLoginCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletionRequestedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletionScheduledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
