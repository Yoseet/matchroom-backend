import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type InterestAction = 'interested' | 'dismissed';

@Entity('user_interests')
@Unique('uq_user_interests_pair', ['fromUserId', 'toUserId'])
@Check(
  'chk_user_interests_action',
  `action IN ('interested','dismissed')`,
)
@Check('chk_user_interests_not_self', 'from_user_id <> to_user_id')
@Index('idx_user_interests_to_action', ['toUserId', 'action'])
@Index('idx_user_interests_from_interested', ['fromUserId', 'createdAt'], {
  where: `"action" = 'interested'`,
})
export class UserInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  fromUserId: string;

  @Column({ type: 'uuid' })
  toUserId: string;

  @Column({ type: 'text' })
  action: InterestAction;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
