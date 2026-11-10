import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { VisitsFrequency } from './lifestyle-profile.entity.js';

export type PolicyPreference = 'accept' | 'reject' | 'indifferent';

export const EXCLUSIVE_CRITERIA = [
  'smoking',
  'pets',
  'noise',
  'visits',
  'cleanliness',
  'age',
] as const;

export type ExclusiveCriterion = (typeof EXCLUSIVE_CRITERIA)[number];

@Entity('roommate_preferences')
@Check(
  'chk_roommate_smoking_policy',
  `smoking_policy IN ('accept','reject','indifferent')`,
)
@Check(
  'chk_roommate_pets_policy',
  `pets_policy IN ('accept','reject','indifferent')`,
)
@Check('chk_roommate_max_noise', 'max_noise_level BETWEEN 1 AND 5')
@Check(
  'chk_roommate_max_visits',
  `max_visits_frequency IN ('never','rare','sometimes','often')`,
)
@Check(
  'chk_roommate_min_cleanliness',
  'min_cleanliness_level BETWEEN 1 AND 5',
)
@Check(
  'chk_roommate_age_range',
  'min_age IS NULL OR max_age IS NULL OR min_age <= max_age',
)
@Check(
  'chk_roommate_exclusive_criteria',
  `exclusive_criteria <@ ARRAY['smoking','pets','noise','visits','cleanliness','age']::text[]`,
)
export class RoommatePreference {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  smokingPolicy: PolicyPreference | null;

  @Column({ type: 'text', nullable: true })
  petsPolicy: PolicyPreference | null;

  @Column({ type: 'smallint', nullable: true })
  maxNoiseLevel: number | null;

  @Column({ type: 'text', nullable: true })
  maxVisitsFrequency: VisitsFrequency | null;

  @Column({ type: 'smallint', nullable: true })
  minCleanlinessLevel: number | null;

  @Column({ type: 'smallint', nullable: true })
  minAge: number | null;

  @Column({ type: 'smallint', nullable: true })
  maxAge: number | null;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  exclusiveCriteria: ExclusiveCriterion[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
