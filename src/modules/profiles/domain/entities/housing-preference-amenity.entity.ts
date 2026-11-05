import { Entity, PrimaryColumn } from 'typeorm';

@Entity('housing_preference_amenities')
export class HousingPreferenceAmenity {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  amenityId: string;
}
