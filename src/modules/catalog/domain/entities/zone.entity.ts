import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('zones')
@Unique('uq_zones_city_slug', ['cityId', 'slug'])
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_zones_city_id')
  @Column({ type: 'uuid' })
  cityId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  slug: string;

  @Index('idx_zones_postal_code')
  @Column({ type: 'varchar', length: 5, nullable: true })
  postalCode: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
