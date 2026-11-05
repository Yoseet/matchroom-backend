import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type VerificationStatus =
  | 'in_progress'
  | 'verified'
  | 'rejected'
  | 'manual_review';

@Entity('identity_verifications')
@Unique('uq_identity_verifications_user_attempt', [
  'userId',
  'attemptNumber',
])
@Index('uq_identity_verifications_in_progress_user', ['userId'], {
  unique: true,
  where: `"status" = 'in_progress'`,
})
@Check(
  'chk_identity_verifications_status',
  `status IN ('in_progress','verified','rejected','manual_review')`,
)
export class IdentityVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  provider: string;

  @Column({ type: 'text', nullable: true, select: false })
  providerReference: string | null;

  @Column({ type: 'text' })
  status: VerificationStatus;

  @Column({ type: 'smallint' })
  attemptNumber: number;

  @Column({ type: 'text', nullable: true })
  rejectionCode: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
