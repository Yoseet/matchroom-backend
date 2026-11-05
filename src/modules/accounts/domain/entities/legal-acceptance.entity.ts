import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type LegalDocumentType = 'terms' | 'privacy';

@Entity('legal_acceptances')
@Unique('uq_legal_acceptances_user_document_version', [
  'userId',
  'documentType',
  'documentVersion',
])
@Check(
  'chk_legal_acceptances_document_type',
  `document_type IN ('terms','privacy')`,
)
export class LegalAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  documentType: LegalDocumentType;

  @Column({ type: 'text' })
  documentVersion: string;

  @Column({ type: 'boolean' })
  adultDeclared: boolean;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  acceptedAt: Date;
}
