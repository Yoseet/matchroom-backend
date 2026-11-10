import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertCanSubmitReview,
  assertEditableStatus,
  assertLandlordStatusTransition,
  assertTransition,
  canChangeLandlordStatus,
  canTransition,
} from './property-status.js';

describe('property status transitions', () => {
  it('accepts the documented full-graph transitions', () => {
    expect(canTransition('draft', 'in_review')).toBe(true);
    expect(canTransition('in_review', 'active')).toBe(true);
    expect(canTransition('active', 'reserved')).toBe(true);
    expect(canTransition('reserved', 'rented')).toBe(true);
    expect(canTransition('paused', 'active')).toBe(true);
    expect(canTransition('expired', 'active')).toBe(true);
    expect(canTransition('active', 'deleted')).toBe(true);
  });

  it('rejects transitions outside the documented graph', () => {
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('in_review', 'deleted')).toBe(false);
    expect(canTransition('deleted', 'active')).toBe(false);

    expect(() => assertTransition('draft', 'active')).toThrow(
      BadRequestException,
    );
  });

  it('only exposes landlord availability transitions', () => {
    expect(canChangeLandlordStatus('active', 'reserved')).toBe(true);
    expect(canChangeLandlordStatus('reserved', 'rented')).toBe(true);
    expect(canChangeLandlordStatus('rented', 'active')).toBe(true);
    expect(canChangeLandlordStatus('paused', 'active')).toBe(true);
    expect(canChangeLandlordStatus('in_review', 'active')).toBe(false);
    expect(canChangeLandlordStatus('draft', 'in_review')).toBe(false);

    expect(() => assertLandlordStatusTransition('in_review', 'active')).toThrow(
      BadRequestException,
    );
  });

  it('locks in-review, rented and deleted listings against edits', () => {
    expect(() => assertEditableStatus('draft')).not.toThrow();
    expect(() => assertEditableStatus('rejected')).not.toThrow();
    expect(() => assertEditableStatus('active')).not.toThrow();
    expect(() => assertEditableStatus('in_review')).toThrow(
      BadRequestException,
    );
    expect(() => assertEditableStatus('rented')).toThrow(BadRequestException);
    expect(() => assertEditableStatus('deleted')).toThrow(BadRequestException);
  });

  it('only submits draft or rejected listings to review', () => {
    expect(() => assertCanSubmitReview('draft')).not.toThrow();
    expect(() => assertCanSubmitReview('rejected')).not.toThrow();
    expect(() => assertCanSubmitReview('active')).toThrow(BadRequestException);
  });
});
