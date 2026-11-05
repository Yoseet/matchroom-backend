import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LookingFor = 'roommate' | 'housing' | 'both';

@Entity('profiles')
@Check('chk_profiles_looking_for', `looking_for IN ('roommate','housing','both')`)
@Check('chk_profiles_bio_length', 'bio IS NULL OR length(bio) <= 500')
@Check(
  'chk_profiles_completeness',
  'completeness_pct BETWEEN 0 AND 100',
)
@Index('idx_profiles_city_completeness', ['cityId', 'completenessPct'])
export class Profile {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  firstName: string | null;

  @Column({ type: 'text', nullable: true })
  lastName: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'text', nullable: true })
  gender: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  occupation: string | null;

  @Column({ type: 'text', nullable: true })
  contactPhone: string | null;

  @Column({ type: 'uuid', nullable: true })
  photoAssetId: string | null;

  @Column({ type: 'text', default: 'both' })
  lookingFor: LookingFor;

  @Column({ type: 'uuid', nullable: true })
  cityId: string | null;

  @Column({ type: 'smallint', default: 0 })
  completenessPct: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
