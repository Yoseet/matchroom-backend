import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HousingPropertyType = 'room' | 'apartment' | 'any';

@Entity('housing_preferences')
@Check(
  'chk_housing_property_type',
  `property_type IN ('room','apartment','any')`,
)
@Check('chk_housing_budget_min', 'budget_min IS NULL OR budget_min >= 0')
@Check('chk_housing_budget_max', 'budget_max IS NULL OR budget_max >= 0')
@Check(
  'chk_housing_budget_range',
  'budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max',
)
export class HousingPreference {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  propertyType: HousingPropertyType | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  budgetMin: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  budgetMax: string | null;

  @Column({ type: 'date', nullable: true })
  moveInDate: string | null;

  @Column({ type: 'boolean', nullable: true })
  requiresFurnished: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  requiresPetsAllowed: boolean | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
