import { BadRequestException } from '@nestjs/common';

/**
 * Opaque keyset cursor. Callers are responsible for validating the payload
 * shape before using its values in a query.
 */
export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(
  rawCursor: string | undefined,
): Record<string, unknown> | undefined {
  if (!rawCursor) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(rawCursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('Cursor payload is not an object');
    }

    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
