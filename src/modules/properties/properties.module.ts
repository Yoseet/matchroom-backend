import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FavoriteProperty,
  Property,
  PropertyAmenity,
  PropertyPhoto,
  PropertyStatusHistory,
} from './domain/entities/index.js';
import { PropertiesService } from './application/services/properties.service.js';
import { PropertyQueryService } from './application/services/property-query.service.js';
import { PropertiesController } from './presentation/controllers/properties.controller.js';
import { PropertyContactsController } from './presentation/controllers/property-contacts.controller.js';
import { PropertyFavoritesController } from './presentation/controllers/property-favorites.controller.js';

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
  controllers: [
    PropertiesController,
    PropertyFavoritesController,
    PropertyContactsController,
  ],
  providers: [PropertiesService, PropertyQueryService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
