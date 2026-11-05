import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type MediaKind =
  | 'profile_photo'
  | 'property_photo'
  | 'chat_image'
  | 'report_evidence';

export type MediaMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

@Entity('media_assets')
@Unique('uq_media_assets_storage_key', ['storageKey'])
@Check(
  'chk_media_assets_kind',
  `kind IN ('profile_photo','property_photo','chat_image','report_evidence')`,
)
@Check(
  'chk_media_assets_mime_type',
  `mime_type IN ('image/jpeg','image/png','image/webp')`,
)
@Check(
  'chk_media_assets_size',
  'size_bytes BETWEEN 1 AND 5242880',
)
@Check(
  'chk_media_assets_moderation_status',
  `moderation_status IN ('pending','approved','rejected')`,
)
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_media_assets_owner_user_id')
  @Column({ type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'text' })
  kind: MediaKind;

  @Column({ type: 'text' })
  storageKey: string;

  @Column({ type: 'text' })
  mimeType: MediaMimeType;

  @Column({ type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

  @Column({ type: 'text', default: 'pending' })
  moderationStatus: ModerationStatus;

  @Column({ type: 'text', nullable: true })
  moderationReason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
