import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('amenities')
@Unique('uq_amenities_code', ['code'])
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
