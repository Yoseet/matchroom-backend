import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  LANDLORD_STATUS_TARGETS,
  type LandlordStatusTarget,
} from '../property-status.js';

export class ChangePropertyStatusDto {
  @IsIn(LANDLORD_STATUS_TARGETS)
  status: LandlordStatusTarget;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
