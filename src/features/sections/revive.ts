// Shape readers used while reconstructing routines. validateRoutines rejects
// input that reconstruction would change, so invalid fields are never silently
// discarded from accepted saved data or backups.

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

// Collects reconstructed rows; the caller checks that no input was lost.
export function asRows<T>(
  value: unknown,
  revive: (row: unknown) => T | null,
  limit?: number,
): T[] {
  if (!Array.isArray(value)) return [];
  const kept: T[] = [];
  for (const row of value) {
    const revived = revive(row);
    if (revived !== null) kept.push(revived);
    if (limit !== undefined && kept.length >= limit) break;
  }
  return kept;
}
