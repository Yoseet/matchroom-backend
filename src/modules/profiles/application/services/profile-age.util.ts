const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `YYYY-MM-DD` value as UTC midnight.
 *
 * Returns `null` for malformed or impossible dates (for example 2026-02-31),
 * which `Date` would otherwise normalize silently.
 */
export function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** Full years between `birthDate` and today, or null for invalid input. */
export function calculateAge(
  birthDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = parseDateOnly(birthDate);
  if (!birth) {
    return null;
  }

  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();

  if (
    monthDelta < 0 ||
    (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}
