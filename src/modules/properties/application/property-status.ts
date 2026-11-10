import { BadRequestException } from '@nestjs/common';
import type { PropertyStatus, PropertyType } from '../domain/entities/index.js';

export const PROPERTY_TYPES = [
  'room',
  'apartment',
] as const satisfies readonly PropertyType[];

export const PROPERTY_STATUSES = [
  'draft',
  'in_review',
  'active',
  'reserved',
  'rented',
  'paused',
  'rejected',
  'deleted',
  'expired',
] as const satisfies readonly PropertyStatus[];

export const PROPERTY_SORTS = ['newest', 'price_asc', 'price_desc'] as const;

export type PropertySort = (typeof PROPERTY_SORTS)[number];

export const LANDLORD_STATUS_TARGETS = [
  'active',
  'reserved',
  'rented',
  'paused',
] as const;

export type LandlordStatusTarget = (typeof LANDLORD_STATUS_TARGETS)[number];

/**
 * Full status graph from the schema document. Used by controlled flows such as
 * deletion and submission to review.
 */
export const PROPERTY_STATUS_TRANSITIONS: Record<
  PropertyStatus,
  readonly PropertyStatus[]
> = {
  draft: ['in_review', 'deleted'],
  in_review: ['active', 'rejected'],
  active: ['reserved', 'rented', 'paused', 'expired', 'deleted'],
  reserved: ['active', 'rented', 'paused', 'deleted'],
  rented: ['active', 'deleted'],
  paused: ['active', 'deleted'],
  rejected: ['draft', 'in_review', 'deleted'],
  deleted: [],
  expired: ['active', 'deleted'],
};

/**
 * Status changes a landlord can request from the availability endpoint. The
 * moderation transitions (`in_review -> active/rejected`) are intentionally
 * excluded because they belong to the review process.
 */
export const LANDLORD_STATUS_TRANSITIONS: Partial<
  Record<PropertyStatus, readonly LandlordStatusTarget[]>
> = {
  active: ['reserved', 'rented', 'paused'],
  reserved: ['active', 'rented', 'paused'],
  rented: ['active'],
  paused: ['active'],
  expired: ['active'],
};

export const EDITABLE_PROPERTY_STATUSES = [
  'draft',
  'rejected',
  'active',
  'reserved',
  'paused',
  'expired',
] as const satisfies readonly PropertyStatus[];

export function canTransition(
  from: PropertyStatus,
  to: PropertyStatus,
): boolean {
  return PROPERTY_STATUS_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: PropertyStatus,
  to: PropertyStatus,
): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `Invalid property status transition from ${from} to ${to}`,
    );
  }
}

export function canChangeLandlordStatus(
  from: PropertyStatus,
  to: LandlordStatusTarget,
): boolean {
  return LANDLORD_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertLandlordStatusTransition(
  from: PropertyStatus,
  to: LandlordStatusTarget,
): void {
  if (!canChangeLandlordStatus(from, to)) {
    throw new BadRequestException(
      `Invalid property status transition from ${from} to ${to}`,
    );
  }
}

export function assertEditableStatus(status: PropertyStatus): void {
  if (
    !(EDITABLE_PROPERTY_STATUSES as readonly PropertyStatus[]).includes(status)
  ) {
    throw new BadRequestException(
      `Property cannot be edited while in status ${status}`,
    );
  }
}

export function assertCanSubmitReview(status: PropertyStatus): void {
  if (status !== 'draft' && status !== 'rejected') {
    throw new BadRequestException(
      `Only draft or rejected properties can be submitted to review, current status is ${status}`,
    );
  }
}
