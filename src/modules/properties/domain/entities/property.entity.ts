import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  pointTransformer,
  type GeoPoint,
} from '../../../../common/database/point.transformer.js';

export type PropertyType = 'room' | 'apartment';

export type PropertyStatus =
  | 'draft'
  | 'in_review'
  | 'active'
  | 'reserved'
  | 'rented'
  | 'paused'
  | 'rejected'
  | 'deleted'
  | 'expired';

@Entity('properties')
@Check('chk_properties_type', `property_type IN ('room','apartment')`)
@Check(
  'chk_properties_status',
  `status IN ('draft','in_review','active','reserved','rented','paused','rejected','deleted','expired')`,
)
@Check('chk_properties_rent', 'rent_amount IS NULL OR rent_amount > 0')
@Check(
  'chk_properties_deposit',
  'deposit_amount IS NULL OR deposit_amount >= 0',
)
@Check(
  'chk_properties_additional_costs',
  'additional_costs_estimate IS NULL OR additional_costs_estimate >= 0',
)
@Check('chk_properties_bedrooms', 'bedrooms IS NULL OR bedrooms >= 0')
@Check('chk_properties_bathrooms', 'bathrooms IS NULL OR bathrooms >= 0')
@Check(
  'chk_properties_min_contract',
  'min_contract_months IS NULL OR min_contract_months >= 0',
)
@Check(
  'chk_properties_title_length',
  'title IS NULL OR length(title) <= 120',
)
@Check(
  'chk_properties_publishable',
  `status IN ('draft','deleted') OR (
    title IS NOT NULL
    AND property_type IS NOT NULL
    AND city_id IS NOT NULL
    AND zone_id IS NOT NULL
    AND rent_amount IS NOT NULL
    AND available_from IS NOT NULL
    AND location_public IS NOT NULL
  )`,
)
@Index('idx_properties_search', ['cityId', 'zoneId', 'rentAmount'], {
  where: `"status" = 'active' AND "deleted_at" IS NULL`,
})
@Index('idx_properties_landlord_status', ['landlordId', 'status'])
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  landlordId: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  propertyType: PropertyType | null;

  @Column({ type: 'uuid', nullable: true })
  cityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  zoneId: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  addressExact: string | null;

  @Column({
    type: 'point',
    nullable: true,
    select: false,
    transformer: pointTransformer,
  })
  locationExact: GeoPoint | null;

  @Index('idx_properties_location_public', { spatial: true })
  @Column({
    type: 'point',
    nullable: true,
    transformer: pointTransformer,
  })
  locationPublic: GeoPoint | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  rentAmount: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  depositAmount: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  additionalCostsEstimate: string | null;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  availableFrom: string | null;

  @Column({ type: 'smallint', nullable: true })
  bedrooms: number | null;

  @Column({ type: 'smallint', nullable: true })
  bathrooms: number | null;

  @Column({ type: 'boolean', default: false })
  furnished: boolean;

  @Column({ type: 'boolean', default: false })
  petsAllowed: boolean;

  @Column({ type: 'boolean', default: false })
  smokersAllowed: boolean;

  @Column({ type: 'text', nullable: true })
  houseRules: string | null;

  @Column({ type: 'boolean', default: false })
  requiresGuarantor: boolean;

  @Column({ type: 'boolean', default: false })
  requiresIncomeProof: boolean;

  @Column({ type: 'smallint', nullable: true })
  minContractMonths: number | null;

  @Column({ type: 'text', default: 'draft' })
  status: PropertyStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
