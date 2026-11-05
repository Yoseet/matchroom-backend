import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('conversation_participants')
@Index('idx_conversation_participants_user_conversation', [
  'userId',
  'conversationId',
])
export class ConversationParticipant {
  @PrimaryColumn({ type: 'uuid' })
  conversationId: string;

  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
