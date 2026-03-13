import type { Prisma } from '@workspace/database';

export function toJsonRecord(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
