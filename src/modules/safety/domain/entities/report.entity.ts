import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ReportTargetType = 'user' | 'property' | 'message';

export type ReportReason =
  | 'fraud'
  | 'duplicate'
  | 'false_info'
  | 'inappropriate_content'
  | 'harassment'
  | 'other';

export type ReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

@Entity('reports')
@Check(
  'chk_reports_target_type',
  `target_type IN ('user','property','message')`,
)
@Check(
  'chk_reports_reason',
  `reason IN ('fraud','duplicate','false_info','inappropriate_content','harassment','other')`,
)
@Check(
  'chk_reports_status',
  `status IN ('open','in_review','resolved','dismissed')`,
)
@Check(
  'chk_reports_target',
  `num_nonnulls(target_user_id, target_property_id, target_message_id) = 1
   AND (
     (target_type = 'user' AND target_user_id IS NOT NULL)
     OR (target_type = 'property' AND target_property_id IS NOT NULL)
     OR (target_type = 'message' AND target_message_id IS NOT NULL)
   )`,
)
@Index('idx_reports_status_created', ['status', 'createdAt'])
@Index('idx_reports_target_user', ['targetUserId'])
@Index('idx_reports_target_property', ['targetPropertyId'])
@Index('idx_reports_target_message', ['targetMessageId'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'text' })
  targetType: ReportTargetType;

  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetPropertyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetMessageId: string | null;

  @Column({ type: 'text' })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'uuid', nullable: true })
  evidenceAssetId: string | null;

  @Column({ type: 'text', default: 'open' })
  status: ReportStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
