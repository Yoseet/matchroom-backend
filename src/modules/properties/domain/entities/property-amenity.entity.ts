import { Entity, PrimaryColumn } from 'typeorm';

@Entity('property_amenities')
export class PropertyAmenity {
  @PrimaryColumn({ type: 'uuid' })
  propertyId: string;

  @PrimaryColumn({ type: 'uuid' })
  amenityId: string;
}
