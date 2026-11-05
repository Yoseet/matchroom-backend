import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('messages')
@Unique('uq_messages_client_id', [
  'conversationId',
  'senderId',
  'clientMessageId',
])
@Check(
  'chk_messages_content',
  `(body IS NOT NULL AND length(trim(body)) > 0) OR media_asset_id IS NOT NULL`,
)
@Index('idx_messages_conversation_id', ['conversationId', 'id'])
export class Message {
  /**
   * UUID v7 is recommended so ids remain time-sortable. The database keeps a
   * random-UUID default so rows inserted outside the application still work.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'uuid' })
  clientMessageId: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'uuid', nullable: true })
  mediaAssetId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
