// Everything in a persisted section file was written by some earlier version of
// Cresco, so on the way back in it is unknown JSON, not the declared type. The
// helpers here rebuild a known-good value from it and drop whatever does not
// fit, rather than casting and letting the first method call on a wrong type
// take the screen down.
//
// Dropping is deliberate. A field whose shape changed cannot be translated
// without inventing what the old data meant, and an invented automation rule or
// account figure is worse than an absent one. The section store keeps the
// previous file beside the current one, so a drop stays recoverable.

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

export const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

// A non-empty string is what every stored id, date and label has in common; an
// empty one means the row cannot be addressed or rendered.
export const asText = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const asMember = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback);

// One of a fixed set, with no sensible default: an unrecognised value means the
// row came from a version that meant something else by it, so it is dropped.
export const asStrictMember = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null => (allowed.includes(value as T) ? (value as T) : null);

// Keeps the rows a validator accepts and drops the rest, so one unreadable row
// never costs the whole list.
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

// A flag map keyed by an arbitrary string: keep every entry whose key is usable
// and whose value is a real boolean, and discard the rest, so a stale map cannot
// carry a non-boolean. A stored `false` is a deliberate off, not an absence.
export function asFlagMap(value: unknown): Record<string, boolean> {
  const source = asRecord(value);
  const flags: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(source)) {
    if (key.length > 0 && typeof flag === "boolean") flags[key] = flag;
  }
  return flags;
}

// The same idea for free text: keep every entry whose key and value are both
// usable strings. An empty value is dropped, because an empty reflection and no
// reflection are the same thing and storing both invites one to outlive the
// other.
export function asTextMap(value: unknown, limit = 500): Record<string, string> {
  const source = asRecord(value);
  const text: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (Object.keys(text).length >= limit) break;
    if (key.length > 0 && typeof entry === "string" && entry.length > 0)
      text[key] = entry;
  }
  return text;
}
