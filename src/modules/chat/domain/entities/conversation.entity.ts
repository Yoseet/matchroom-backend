import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ConversationKind = 'roommate' | 'rental';
export type ConversationStatus = 'active' | 'closed';
export type ConversationClosedReason =
  | 'unmatched'
  | 'blocked'
  | 'account_deleted';

@Entity('conversations')
@Check('chk_conversations_kind', `kind IN ('roommate','rental')`)
@Check('chk_conversations_status', `status IN ('active','closed')`)
@Check(
  'chk_conversations_closed_reason',
  `closed_reason IN ('unmatched','blocked','account_deleted')`,
)
@Check(
  'chk_conversations_kind_shape',
  `(kind = 'roommate' AND match_id IS NOT NULL AND property_id IS NULL AND initiator_user_id IS NULL)
   OR
   (kind = 'rental' AND property_id IS NOT NULL AND match_id IS NULL AND initiator_user_id IS NOT NULL)`,
)
@Index('uq_conversations_match', ['matchId'], {
  unique: true,
  where: `"kind" = 'roommate'`,
})
@Index(
  'uq_conversations_property_initiator',
  ['propertyId', 'initiatorUserId'],
  { unique: true, where: `"kind" = 'rental'` },
)
@Index('idx_conversations_last_message_at', ['lastMessageAt'], {
  // PostgreSQL sorts NULLS LAST by default in ASC; the partial index below
  // mirrors the DESC query path used by the inbox.
  where: `"last_message_at" IS NOT NULL`,
})
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  kind: ConversationKind;

  @Column({ type: 'uuid', nullable: true })
  matchId: string | null;

  @Column({ type: 'uuid', nullable: true })
  propertyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  initiatorUserId: string | null;

  @Column({ type: 'text', default: 'active' })
  status: ConversationStatus;

  @Column({ type: 'text', nullable: true })
  closedReason: ConversationClosedReason | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
