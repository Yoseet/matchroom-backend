import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('keyset pagination cursor', () => {
  it('round-trips the payload', () => {
    const payload = {
      s: 'newest',
      c: '2026-11-10T12:00:00.000Z',
      i: '5a9b0d6e-6c43-4e8f-9f4e-1f0a4f6d3b21',
    };

    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('returns undefined when no cursor is provided', () => {
    expect(decodeCursor(undefined)).toBeUndefined();
    expect(decodeCursor('')).toBeUndefined();
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-a-valid-cursor')).toThrow(
      BadRequestException,
    );
    expect(() =>
      decodeCursor(Buffer.from('"a string"', 'utf8').toString('base64url')),
    ).toThrow(BadRequestException);
  });
});
