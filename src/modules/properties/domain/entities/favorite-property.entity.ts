import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('favorite_properties')
export class FavoriteProperty {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  propertyId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
