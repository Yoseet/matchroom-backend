import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProfileVisibility =
  | 'everyone'
  | 'verified_only'
  | 'matches_only';

@Entity('privacy_settings')
@Check(
  'chk_privacy_settings_visibility',
  `profile_visibility IN ('everyone','verified_only','matches_only')`,
)
export class PrivacySetting {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text', default: 'everyone' })
  profileVisibility: ProfileVisibility;

  @Column({ type: 'boolean', default: true })
  showExactAge: boolean;

  @Column({ type: 'boolean', default: true })
  showOccupation: boolean;

  @Column({ type: 'boolean', default: true })
  showPhoto: boolean;

  @Column({ type: 'boolean', default: true })
  appearInSearch: boolean;

  @Column({ type: 'boolean', default: true })
  showHousingPreferences: boolean;

  @Column({ type: 'boolean', default: false })
  showPropertyInterest: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
