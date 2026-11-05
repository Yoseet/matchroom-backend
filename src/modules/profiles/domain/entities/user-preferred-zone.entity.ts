import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('user_preferred_zones')
@Index('idx_user_preferred_zones_zone_user', ['zoneId', 'userId'])
export class UserPreferredZone {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  zoneId: string;
}
