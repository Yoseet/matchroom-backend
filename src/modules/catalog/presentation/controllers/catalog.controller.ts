import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ListAmenitiesQueryDto,
  PaginatedAmenitiesResponseDto,
} from '../../application/dto/amenity.dto.js';
import {
  AutocompleteQueryDto,
  PaginatedAutocompleteResponseDto,
} from '../../application/dto/autocomplete.dto.js';
import {
  ListCitiesQueryDto,
  PaginatedCitiesResponseDto,
} from '../../application/dto/city.dto.js';
import {
  ListZonesQueryDto,
  PaginatedZonesResponseDto,
} from '../../application/dto/zone.dto.js';
import { CatalogService } from '../../application/services/catalog.service.js';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('cities')
  @ApiOperation({
    summary: 'Lista ciudades activas',
    description:
      'Devuelve las ciudades activas con paginación. Se puede filtrar por ' +
      'estado (`stateName`) y por código postal para obtener solo las ' +
      'ciudades que tienen alguna zona con ese CP.',
  })
  @ApiOkResponse({
    description: 'Ciudades encontradas.',
    type: PaginatedCitiesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos.',
  })
  listCities(
    @Query() query: ListCitiesQueryDto,
  ): Promise<PaginatedCitiesResponseDto> {
    return this.catalogService.listCities(query);
  }

  @Get('amenities')
  @ApiOperation({
    summary: 'Lista amenidades activas',
    description:
      'Devuelve las amenidades activas del catálogo con paginación. ' +
      'Están pensadas para mostrarse al publicar o filtrar propiedades.',
  })
  @ApiOkResponse({
    description: 'Amenidades encontradas.',
    type: PaginatedAmenitiesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos.',
  })
  listAmenities(
    @Query() query: ListAmenitiesQueryDto,
  ): Promise<PaginatedAmenitiesResponseDto> {
    return this.catalogService.listAmenities(query);
  }

  @Get('zones')
  @ApiOperation({
    summary: 'Lista zonas activas',
    description:
      'Devuelve zonas activas con paginación. Sin `cityId` lista zonas de ' +
      'todas las ciudades activas; con `cityId` lista solo las de esa ciudad. ' +
      'También se puede filtrar por código postal.',
  })
  @ApiOkResponse({
    description: 'Zonas encontradas.',
    type: PaginatedZonesResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos.',
  })
  listZones(
    @Query() query: ListZonesQueryDto,
  ): Promise<PaginatedZonesResponseDto> {
    return this.catalogService.listZones(query);
  }

  @Get('autocomplete')
  @ApiOperation({
    summary: 'Autocompletado de ciudades y zonas',
    description:
      'Busca por nombre de ciudad, nombre de zona o código postal. Los ' +
      'resultados se ordenan por coincidencia al inicio del texto.',
  })
  @ApiOkResponse({
    description: 'Resultados del autocompletado.',
    type: PaginatedAutocompleteResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos.',
  })
  autocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<PaginatedAutocompleteResponseDto> {
    return this.catalogService.autocomplete(query);
  }
}
