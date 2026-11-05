import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('property_photos')
@Unique('uq_property_photos_asset_id', ['assetId'])
@Unique('uq_property_photos_property_position', [
  'propertyId',
  'position',
])
@Index('uq_property_photos_cover', ['propertyId'], {
  unique: true,
  where: `"is_cover" = true`,
})
@Check('chk_property_photos_position', 'position BETWEEN 1 AND 15')
export class PropertyPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  propertyId: string;

  @Column({ type: 'uuid' })
  assetId: string;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ type: 'boolean', default: false })
  isCover: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
