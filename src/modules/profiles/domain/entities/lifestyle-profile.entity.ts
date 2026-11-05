import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VisitsFrequency = 'never' | 'rare' | 'sometimes' | 'often';
export type SleepSchedule = 'early' | 'regular' | 'late';
export type WorkSchedule =
  | 'morning'
  | 'afternoon'
  | 'night'
  | 'remote'
  | 'flexible';
export type CohabitationType =
  | 'join_existing_home'
  | 'find_place_together'
  | 'any';

@Entity('lifestyle_profiles')
@Check(
  'chk_lifestyle_cleanliness',
  'cleanliness_level BETWEEN 1 AND 5',
)
@Check('chk_lifestyle_noise', 'noise_level BETWEEN 1 AND 5')
@Check(
  'chk_lifestyle_visits',
  `visits_frequency IN ('never','rare','sometimes','often')`,
)
@Check(
  'chk_lifestyle_sleep',
  `sleep_schedule IN ('early','regular','late')`,
)
@Check(
  'chk_lifestyle_work',
  `work_schedule IN ('morning','afternoon','night','remote','flexible')`,
)
@Check(
  'chk_lifestyle_cohabitation',
  `cohabitation_type IN ('join_existing_home','find_place_together','any')`,
)
export class LifestyleProfile {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'smallint', nullable: true })
  cleanlinessLevel: number | null;

  @Column({ type: 'boolean', nullable: true })
  smokes: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  hasPets: boolean | null;

  @Column({ type: 'smallint', nullable: true })
  noiseLevel: number | null;

  @Column({ type: 'text', nullable: true })
  visitsFrequency: VisitsFrequency | null;

  @Column({ type: 'text', nullable: true })
  sleepSchedule: SleepSchedule | null;

  @Column({ type: 'text', nullable: true })
  workSchedule: WorkSchedule | null;

  @Column({ type: 'text', nullable: true })
  cohabitationType: CohabitationType | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
