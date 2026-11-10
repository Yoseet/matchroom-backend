import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
import { ContactsQueryDto } from '../../application/dto/contacts-query.dto.js';
import { PropertyContactListResponseDto } from '../../application/dto/property-response.dto.js';
import { PropertiesService } from '../../application/services/properties.service.js';

@ApiTags('properties')
@Controller('properties')
@ApiHeader({
  name: CURRENT_USER_ID_HEADER,
  required: true,
  description: CURRENT_USER_ID_DESCRIPTION,
})
export class PropertyContactsController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get(':propertyId/contacts')
  @ApiOperation({
    summary: 'Consultar los contactos generados por un anuncio',
    description:
      'Deriva los contactos de las conversaciones rental del anuncio. Solo el arrendador propietario puede consultarlos.',
  })
  @ApiOkResponse({ type: PropertyContactListResponseDto })
  @ApiBadRequestResponse({ description: 'Cursor de paginación inválido.' })
  @ApiForbiddenResponse({ description: 'El anuncio no pertenece al usuario.' })
  @ApiNotFoundResponse({
    description: 'El anuncio no existe o está eliminado.',
  })
  findContacts(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @CurrentUserId() userId: string,
    @Query() query: ContactsQueryDto,
  ): Promise<PropertyContactListResponseDto> {
    return this.propertiesService.findContacts(propertyId, userId, query);
  }
}
