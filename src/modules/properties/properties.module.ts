import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FavoriteProperty,
  Property,
  PropertyAmenity,
  PropertyPhoto,
  PropertyStatusHistory,
} from './domain/entities/index.js';

/**
 * Properties bounded context: listings, media, amenities, favourites and the
 * moderation status trail.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      PropertyPhoto,
      PropertyAmenity,
      PropertyStatusHistory,
      FavoriteProperty,
    ]),
  ],
})
export class PropertiesModule {}
