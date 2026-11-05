import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type MatchStatus = 'active' | 'unmatched';

@Entity('matches')
@Unique('uq_matches_pair', ['userAId', 'userBId'])
@Check('chk_matches_order', 'user_a_id < user_b_id')
@Check('chk_matches_status', `status IN ('active','unmatched')`)
@Index('idx_matches_user_a', ['userAId'])
@Index('idx_matches_user_b', ['userBId'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userAId: string;

  @Column({ type: 'uuid' })
  userBId: string;

  @Column({ type: 'text', default: 'active' })
  status: MatchStatus;

  @Column({ type: 'uuid', nullable: true })
  unmatchedBy: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  matchedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  unmatchedAt: Date | null;
}
