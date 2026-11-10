import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
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
  OptionalCurrentUserId,
} from '../../../../common/http/current-user-id.decorator.js';
import { ChangePropertyStatusDto } from '../../application/dto/change-property-status.dto.js';
import { CreatePropertyDto } from '../../application/dto/create-property.dto.js';
import { MyPropertiesQueryDto } from '../../application/dto/my-properties-query.dto.js';
import {
  PropertyAmenitiesResponseDto,
  PropertyDetailDto,
  PropertyListResponseDto,
  PropertyMapResponseDto,
} from '../../application/dto/property-response.dto.js';
import { SearchPropertiesQueryDto } from '../../application/dto/search-properties-query.dto.js';
import { UpdatePropertyAmenitiesDto } from '../../application/dto/update-property-amenities.dto.js';
import { UpdatePropertyDto } from '../../application/dto/update-property.dto.js';
import { PropertiesService } from '../../application/services/properties.service.js';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Buscar anuncios activos de propiedades',
    description:
      'Filtra por ciudad, zonas, precio, tipo, habitaciones, baños, mobiliario, disponibilidad y amenidades. Solo devuelve anuncios active y pagina por cursor.',
  })
  @ApiOkResponse({ type: PropertyListResponseDto })
  @ApiBadRequestResponse({
    description: 'Filtros o cursor de paginación inválidos.',
  })
  search(
    @Query() query: SearchPropertiesQueryDto,
  ): Promise<PropertyListResponseDto> {
    return this.propertiesService.search(query);
  }

  @Get('map')
  @ApiOperation({
    summary: 'Consultar propiedades activas para el mapa',
    description:
      'Devuelve únicamente la ubicación pública. Nunca incluye address_exact ni location_exact.',
  })
  @ApiOkResponse({ type: PropertyMapResponseDto })
  @ApiBadRequestResponse({
    description: 'Filtros o cursor de paginación inválidos.',
  })
  map(
    @Query() query: SearchPropertiesQueryDto,
  ): Promise<PropertyMapResponseDto> {
    return this.propertiesService.map(query);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Consultar mis anuncios por estado',
    description:
      'Lista los anuncios del usuario actual. Si no se envía status, excluye los eliminados.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiOkResponse({ type: PropertyListResponseDto })
  @ApiForbiddenResponse({
    description: 'La cuenta no existe o no está activa.',
  })
  @ApiBadRequestResponse({
    description: 'Estado o cursor de paginación inválidos.',
  })
  findMine(
    @CurrentUserId() userId: string,
    @Query() query: MyPropertiesQueryDto,
  ): Promise<PropertyListResponseDto> {
    return this.propertiesService.findMine(userId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un borrador de anuncio',
    description:
      'El backend asigna landlord_id. Requiere cuenta activa, identidad verificada y modo arrendador habilitado.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiCreatedResponse({ type: PropertyDetailDto })
  @ApiBadRequestResponse({
    description: 'Datos o catálogos inválidos.',
  })
  @ApiForbiddenResponse({
    description:
      'La cuenta no está activa, no tiene identidad verificada o no tiene el modo arrendador habilitado.',
  })
  @ApiConflictResponse({ description: 'Conflicto de integridad de datos.' })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePropertyDto,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.create(dto, userId);
  }

  @Get(':propertyId')
  @ApiOperation({
    summary: 'Ver el detalle de un anuncio',
    description:
      'La dirección y ubicación exactas solo se devuelven al propietario o al interesado con una conversación de renta válida.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: false,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiOkResponse({ type: PropertyDetailDto })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe, está eliminado o no es público.',
  })
  getDetail(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @OptionalCurrentUserId() userId?: string,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.getDetail(propertyId, userId);
  }

  @Patch(':propertyId')
  @ApiOperation({
    summary: 'Editar un anuncio propio',
    description:
      'No se puede editar mientras el anuncio está en revisión, rentado o eliminado.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiOkResponse({ type: PropertyDetailDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o estado actual no editable.',
  })
  @ApiForbiddenResponse({ description: 'El anuncio no pertenece al usuario.' })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe o está eliminado.',
  })
  @ApiConflictResponse({ description: 'Conflicto de integridad de datos.' })
  update(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.update(propertyId, userId, dto);
  }

  @Put(':propertyId/amenities')
  @ApiOperation({
    summary: 'Reemplazar las amenidades de un anuncio propio',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiOkResponse({ type: PropertyAmenitiesResponseDto })
  @ApiBadRequestResponse({
    description: 'Amenidad inexistente/inactiva o estado no editable.',
  })
  @ApiForbiddenResponse({ description: 'El anuncio no pertenece al usuario.' })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe o está eliminado.',
  })
  @ApiConflictResponse({ description: 'Conflicto de integridad de datos.' })
  replaceAmenities(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdatePropertyAmenitiesDto,
  ): Promise<PropertyAmenitiesResponseDto> {
    return this.propertiesService.replaceAmenities(propertyId, userId, dto);
  }

  @Post(':propertyId/submit-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar un anuncio a revisión',
    description:
      'Valida los campos obligatorios y pasa el anuncio de draft/rejected a in_review, registrando el historial.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiOkResponse({ type: PropertyDetailDto })
  @ApiBadRequestResponse({
    description: 'Anuncio incompleto o transición no permitida.',
  })
  @ApiForbiddenResponse({ description: 'El anuncio no pertenece al usuario.' })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe o está eliminado.',
  })
  @ApiConflictResponse({ description: 'Conflicto de integridad de datos.' })
  submitReview(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.submitReview(propertyId, userId);
  }

  @Patch(':propertyId/status')
  @ApiOperation({
    summary: 'Cambiar la disponibilidad de un anuncio propio',
    description:
      'Permite reservar, rentar, pausar o reactivar según las transiciones permitidas. El cambio y el historial se guardan en una transacción.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiOkResponse({ type: PropertyDetailDto })
  @ApiBadRequestResponse({
    description: 'Estado destino o transición no permitida.',
  })
  @ApiForbiddenResponse({ description: 'El anuncio no pertenece al usuario.' })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe o está eliminado.',
  })
  @ApiConflictResponse({ description: 'Conflicto de integridad de datos.' })
  changeStatus(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ChangePropertyStatusDto,
  ): Promise<PropertyDetailDto> {
    return this.propertiesService.changeStatus(propertyId, userId, dto);
  }

  @Delete(':propertyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar lógicamente un anuncio propio',
    description:
      'Marca el anuncio como deleted y conserva el historial; no borra físicamente la fila.',
  })
  @ApiHeader({
    name: CURRENT_USER_ID_HEADER,
    required: true,
    description: CURRENT_USER_ID_DESCRIPTION,
  })
  @ApiNoContentResponse({ description: 'Anuncio marcado como eliminado.' })
  @ApiBadRequestResponse({ description: 'Transición no permitida.' })
  @ApiForbiddenResponse({ description: 'El anuncio no pertenece al usuario.' })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe o ya está eliminado.',
  })
  delete(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
  ): Promise<void> {
    return this.propertiesService.delete(propertyId, userId);
  }
}
