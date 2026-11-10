import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CURRENT_USER_ID_DESCRIPTION,
  CURRENT_USER_ID_HEADER,
  CurrentUserId,
} from '../../../../common/http/current-user-id.decorator.js';
import { PaginationQueryDto } from '../../application/dto/pagination-query.dto.js';
import { FavoritePropertyListResponseDto } from '../../application/dto/property-response.dto.js';
import { PropertiesService } from '../../application/services/properties.service.js';

@ApiTags('properties')
@Controller('properties')
@ApiHeader({
  name: CURRENT_USER_ID_HEADER,
  required: true,
  description: CURRENT_USER_ID_DESCRIPTION,
})
export class PropertyFavoritesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('me/favorites')
  @ApiOperation({
    summary: 'Consultar mis propiedades favoritas',
    description:
      'Excluye anuncios eliminados. Los anuncios no disponibles se conservan y se marcan con isAvailable=false.',
  })
  @ApiOkResponse({ type: FavoritePropertyListResponseDto })
  @ApiForbiddenResponse({
    description: 'La cuenta no existe o no está activa.',
  })
  @ApiBadRequestResponse({ description: 'Cursor de paginación inválido.' })
  findFavorites(
    @CurrentUserId() userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<FavoritePropertyListResponseDto> {
    return this.propertiesService.findFavorites(userId, query);
  }

  @Put(':propertyId/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Agregar un anuncio a favoritos',
    description: 'Es idempotente y solo guarda anuncios activos.',
  })
  @ApiNoContentResponse({ description: 'Anuncio guardado como favorito.' })
  @ApiForbiddenResponse({
    description: 'La cuenta no existe o no está activa.',
  })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe, está eliminado o no está activo.',
  })
  @ApiConflictResponse({ description: 'Conflicto de integridad de datos.' })
  addFavorite(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    return this.propertiesService.addFavorite(propertyId, userId);
  }

  @Delete(':propertyId/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar un anuncio de favoritos',
    description: 'Solo elimina la relación de favorito del usuario actual.',
  })
  @ApiNoContentResponse({ description: 'Anuncio quitado de favoritos.' })
  @ApiForbiddenResponse({
    description: 'La cuenta no existe o no está activa.',
  })
  removeFavorite(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    return this.propertiesService.removeFavorite(propertyId, userId);
  }
}
