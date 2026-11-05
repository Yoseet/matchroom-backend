import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PrivacyRequestType =
  | 'access'
  | 'rectification'
  | 'cancellation'
  | 'opposition';

export type PrivacyRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected';

@Entity('privacy_requests')
@Check(
  'chk_privacy_requests_type',
  `request_type IN ('access','rectification','cancellation','opposition')`,
)
@Check(
  'chk_privacy_requests_status',
  `status IN ('pending','in_progress','completed','rejected')`,
)
export class PrivacyRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  requestType: PrivacyRequestType;

  @Column({ type: 'text', default: 'pending' })
  status: PrivacyRequestStatus;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
