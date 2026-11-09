import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogService } from './application/services/catalog.service.js';
import { Amenity, City, Zone } from './domain/entities/index.js';
import { CatalogController } from './presentation/controllers/catalog.controller.js';

/**
 * Catalog bounded context: geographic catalogs and reusable amenities.
 * Other modules read catalog rows through this module's exported services.
 */
@Module({
  imports: [TypeOrmModule.forFeature([City, Zone, Amenity])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
