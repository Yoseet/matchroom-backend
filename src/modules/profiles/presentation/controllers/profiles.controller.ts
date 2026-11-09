import {
  Body,
  Controller,
  Get,
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
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUserId, USER_ID_HEADER } from '../../../../common/auth/index.js';
import { ListProfilesQueryDto } from '../../application/dto/list-profiles-query.dto.js';
import { ProfileCompletenessResponseDto } from '../../application/dto/profile-completeness-response.dto.js';
import {
  HousingPreferencesResponseDto,
  LifestyleResponseDto,
  OwnProfileResponseDto,
  PreferredAmenitiesResponseDto,
  PreferredZonesResponseDto,
  RoommatePreferencesResponseDto,
} from '../../application/dto/profile-response.dto.js';
import {
  ListProfilesResponseDto,
  PublicProfileResponseDto,
} from '../../application/dto/public-profile-response.dto.js';
import { UpdateHousingPreferencesDto } from '../../application/dto/update-housing-preferences.dto.js';
import { UpdateLifestyleDto } from '../../application/dto/update-lifestyle.dto.js';
import {
  AddPreferredAmenitiesDto,
  UpdatePreferredAmenitiesDto,
} from '../../application/dto/update-preferred-amenities.dto.js';
import {
  AddPreferredZonesDto,
  UpdatePreferredZonesDto,
} from '../../application/dto/update-preferred-zones.dto.js';
import { UpdateProfileDto } from '../../application/dto/update-profile.dto.js';
import { UpdateRoommatePreferencesDto } from '../../application/dto/update-roommate-preferences.dto.js';
import { ProfilesService } from '../../application/services/profiles.service.js';
import { PublicProfilesService } from '../../application/services/public-profiles.service.js';

@ApiTags('profiles')
@ApiHeader({
  name: USER_ID_HEADER,
  required: true,
  description:
    'Identificador del usuario autenticado. Es temporal mientras se integra ' +
    'el módulo de autenticación.',
})
@ApiUnauthorizedResponse({
  description: `Falta el header ${USER_ID_HEADER} o no es un UUID válido.`,
})
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly publicProfilesService: PublicProfilesService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Consulta el perfil propio',
    description:
      'Devuelve datos personales, hábitos, preferencias, zonas, amenidades y ' +
      'el porcentaje de completitud.',
  })
  @ApiOkResponse({ type: OwnProfileResponseDto })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  getOwnProfile(
    @CurrentUserId() userId: string,
  ): Promise<OwnProfileResponseDto> {
    return this.profilesService.getOwnProfile(userId);
  }

  @Post('me')
  @ApiOperation({
    summary: 'Crea el perfil propio',
    description:
      'Crea el perfil del usuario autenticado. Acepta datos personales ' +
      'opcionales. Devuelve 409 si el perfil ya existe; durante el registro ' +
      'el perfil vacío se crea automáticamente desde accounts.',
  })
  @ApiCreatedResponse({ type: OwnProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  @ApiConflictResponse({ description: 'El perfil ya existe.' })
  createOwnProfile(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<OwnProfileResponseDto> {
    return this.profilesService.createProfile(userId, dto);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Crea o edita los datos personales del perfil',
    description:
      'Valida mayoría de edad, límites de texto, ciudad activa y propiedad ' +
      'de la imagen (media_asset de tipo profile_photo del mismo usuario). ' +
      '`lookingFor` permite indicar búsqueda de roomie, vivienda o ambas.',
  })
  @ApiOkResponse({ type: OwnProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  updateOwnProfile(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<OwnProfileResponseDto> {
    return this.profilesService.updateProfile(userId, dto);
  }

  @Post('me/lifestyle')
  @ApiOperation({
    summary: 'Crea los hábitos del perfil',
    description:
      'Crea la fila de lifestyle_profiles del usuario. Devuelve 409 si ya ' +
      'existe; usa PUT para reemplazarla.',
  })
  @ApiCreatedResponse({ type: LifestyleResponseDto })
  @ApiBadRequestResponse({ description: 'Escalas o enums inválidos.' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  @ApiConflictResponse({ description: 'Los hábitos ya existen.' })
  createLifestyle(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateLifestyleDto,
  ): Promise<LifestyleResponseDto> {
    return this.profilesService.createLifestyle(userId, dto);
  }

  @Put('me/lifestyle')
  @ApiOperation({
    summary: 'Reemplaza los hábitos del perfil',
    description:
      'Reemplaza limpieza, tabaquismo, mascotas, ruido, visitas y horarios. ' +
      'Los campos omitidos se guardan como null.',
  })
  @ApiOkResponse({ type: LifestyleResponseDto })
  @ApiBadRequestResponse({ description: 'Escalas o enums inválidos.' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  updateLifestyle(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateLifestyleDto,
  ): Promise<LifestyleResponseDto> {
    return this.profilesService.updateLifestyle(userId, dto);
  }

  @Post('me/roommate-preferences')
  @ApiOperation({
    summary: 'Crea las preferencias de roomie',
    description:
      'Crea la fila de roommate_preferences. Devuelve 409 si ya existe; usa ' +
      'PUT para reemplazarla.',
  })
  @ApiCreatedResponse({ type: RoommatePreferencesResponseDto })
  @ApiBadRequestResponse({
    description: 'Rangos inválidos o códigos de exclusiveCriteria inválidos.',
  })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  @ApiConflictResponse({ description: 'Las preferencias ya existen.' })
  createRoommatePreferences(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateRoommatePreferencesDto,
  ): Promise<RoommatePreferencesResponseDto> {
    return this.profilesService.createRoommatePreferences(userId, dto);
  }

  @Put('me/roommate-preferences')
  @ApiOperation({
    summary: 'Reemplaza las preferencias de roomie',
    description:
      'Guarda las condiciones aceptadas (fumar, mascotas, ruido, visitas, ' +
      'limpieza y edad) y los criterios excluyentes usados por matching.',
  })
  @ApiOkResponse({ type: RoommatePreferencesResponseDto })
  @ApiBadRequestResponse({
    description: 'Rangos inválidos o códigos de exclusiveCriteria inválidos.',
  })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  updateRoommatePreferences(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateRoommatePreferencesDto,
  ): Promise<RoommatePreferencesResponseDto> {
    return this.profilesService.updateRoommatePreferences(userId, dto);
  }

  @Post('me/housing-preferences')
  @ApiOperation({
    summary: 'Crea las preferencias de vivienda',
    description:
      'Crea la fila de housing_preferences. Devuelve 409 si ya existe; usa ' +
      'PUT para reemplazarla.',
  })
  @ApiCreatedResponse({ type: HousingPreferencesResponseDto })
  @ApiBadRequestResponse({ description: 'Presupuesto o fechas inválidas.' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  @ApiConflictResponse({ description: 'Las preferencias ya existen.' })
  createHousingPreferences(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateHousingPreferencesDto,
  ): Promise<HousingPreferencesResponseDto> {
    return this.profilesService.createHousingPreferences(userId, dto);
  }

  @Put('me/housing-preferences')
  @ApiOperation({
    summary: 'Reemplaza las preferencias de vivienda',
    description:
      'Guarda tipo de inmueble, presupuesto, fecha de mudanza, mobiliario y ' +
      'aceptación de mascotas. Valida budgetMin <= budgetMax.',
  })
  @ApiOkResponse({ type: HousingPreferencesResponseDto })
  @ApiBadRequestResponse({ description: 'Presupuesto o fechas inválidas.' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  updateHousingPreferences(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateHousingPreferencesDto,
  ): Promise<HousingPreferencesResponseDto> {
    return this.profilesService.updateHousingPreferences(userId, dto);
  }

  @Post('me/preferred-zones')
  @ApiOperation({
    summary: 'Agrega zonas de interés',
    description:
      'Agrega zonas a la selección actual sin eliminar las existentes. La ' +
      'operación es idempotente; usa PUT para reemplazar la selección.',
  })
  @ApiCreatedResponse({ type: PreferredZonesResponseDto })
  @ApiBadRequestResponse({
    description: 'Zonas inexistentes, inactivas o de otra ciudad.',
  })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  addPreferredZones(
    @CurrentUserId() userId: string,
    @Body() dto: AddPreferredZonesDto,
  ): Promise<PreferredZonesResponseDto> {
    return this.profilesService.addPreferredZones(userId, dto);
  }

  @Put('me/preferred-zones')
  @ApiOperation({
    summary: 'Reemplaza las zonas de interés',
    description:
      'Valida que las zonas existan, estén activas y pertenezcan a la ciudad ' +
      'del perfil. Requiere que el perfil tenga cityId.',
  })
  @ApiOkResponse({ type: PreferredZonesResponseDto })
  @ApiBadRequestResponse({
    description: 'Zonas inexistentes, inactivas o de otra ciudad.',
  })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  replacePreferredZones(
    @CurrentUserId() userId: string,
    @Body() dto: UpdatePreferredZonesDto,
  ): Promise<PreferredZonesResponseDto> {
    return this.profilesService.replacePreferredZones(userId, dto);
  }

  @Post('me/preferred-amenities')
  @ApiOperation({
    summary: 'Agrega amenidades deseadas',
    description:
      'Agrega amenidades a la selección actual sin eliminar las existentes. ' +
      'La operación es idempotente; usa PUT para reemplazar la selección.',
  })
  @ApiCreatedResponse({ type: PreferredAmenitiesResponseDto })
  @ApiBadRequestResponse({ description: 'Amenidades inexistentes o inactivas.' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  addPreferredAmenities(
    @CurrentUserId() userId: string,
    @Body() dto: AddPreferredAmenitiesDto,
  ): Promise<PreferredAmenitiesResponseDto> {
    return this.profilesService.addPreferredAmenities(userId, dto);
  }

  @Put('me/preferred-amenities')
  @ApiOperation({
    summary: 'Reemplaza las amenidades deseadas',
    description:
      'Valida que las amenidades existan y estén activas. Un arreglo vacío ' +
      'limpia la selección.',
  })
  @ApiOkResponse({ type: PreferredAmenitiesResponseDto })
  @ApiBadRequestResponse({ description: 'Amenidades inexistentes o inactivas.' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  replacePreferredAmenities(
    @CurrentUserId() userId: string,
    @Body() dto: UpdatePreferredAmenitiesDto,
  ): Promise<PreferredAmenitiesResponseDto> {
    return this.profilesService.replacePreferredAmenities(userId, dto);
  }

  @Get('me/completeness')
  @ApiOperation({
    summary: 'Consulta la completitud del perfil',
    description:
      'Devuelve el porcentaje y los campos faltantes. La fórmula y los ' +
      'campos obligatorios viven en un único servicio.',
  })
  @ApiOkResponse({ type: ProfileCompletenessResponseDto })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil.' })
  getCompleteness(
    @CurrentUserId() userId: string,
  ): Promise<ProfileCompletenessResponseDto> {
    return this.profilesService.getCompleteness(userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista perfiles descubribles',
    description:
      'Aplica completitud mínima, privacidad, bloqueos y visibilidad. El ' +
      'filtro `lookingFor` usa profiles.looking_for: `roommate` incluye ' +
      'perfiles que buscan roomie o ambos; `housing` incluye vivienda o ' +
      'ambos; `both` u omitido no restringe el tipo de búsqueda.',
  })
  @ApiOkResponse({ type: ListProfilesResponseDto })
  @ApiBadRequestResponse({ description: 'Filtros o cursor inválidos.' })
  listProfiles(
    @CurrentUserId() userId: string,
    @Query() query: ListProfilesQueryDto,
  ): Promise<ListProfilesResponseDto> {
    return this.publicProfilesService.listProfiles(userId, query);
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'Consulta el perfil público de otro usuario',
    description:
      'Aplica privacy_settings (visibilidad, edad, ocupación, foto y ' +
      'preferencias de vivienda), bloqueos y reglas de descubribilidad. ' +
      '`lookingFor` decide si se exponen hábitos/preferencias de roomie y/o ' +
      'de vivienda.',
  })
  @ApiOkResponse({ type: PublicProfileResponseDto })
  @ApiNotFoundResponse({
    description: 'El perfil no existe o no es visible para el usuario.',
  })
  getPublicProfile(
    @CurrentUserId() requesterId: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<PublicProfileResponseDto> {
    return this.publicProfilesService.getPublicProfile(
      requesterId,
      targetUserId,
    );
  }
}
