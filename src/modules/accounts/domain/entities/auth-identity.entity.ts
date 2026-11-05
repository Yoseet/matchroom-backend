import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type AuthProvider = 'google';

@Entity('auth_identities')
@Unique('uq_auth_identities_provider_user', [
  'provider',
  'providerUserId',
])
@Check('chk_auth_identities_provider', `provider IN ('google')`)
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_auth_identities_user_id')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  provider: AuthProvider;

  @Column({ type: 'text' })
  providerUserId: string;

  @Column({ type: 'citext', nullable: true })
  providerEmail: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
