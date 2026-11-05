import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Amenity, City, Zone } from './domain/entities/index.js';

/**
 * Catalog bounded context: geographic catalogs and reusable amenities.
 * Other modules read catalog rows through this module's exported services.
 */
@Module({
  imports: [TypeOrmModule.forFeature([City, Zone, Amenity])],
})
export class CatalogModule {}
