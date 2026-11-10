import { IsIn, IsOptional } from 'class-validator';
import { PROPERTY_STATUSES } from '../property-status.js';
import { PaginationQueryDto } from './pagination-query.dto.js';

export class MyPropertiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PROPERTY_STATUSES)
  status?: (typeof PROPERTY_STATUSES)[number];
}
