import 'server-only';
import { getLocalizedString } from '@/lib/format';

/** A projection attribute as the API returns it. The value is only trusted after narrowing. */
export interface RawAttribute {
  name: string;
  value?: unknown;
}
type Attrs = ReadonlyArray<RawAttribute> | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function raw(attrs: Attrs, name: string): unknown {
  return attrs?.find((attribute) => attribute.name === name)?.value;
}

const localizedOf = (value: unknown, locale: string): string => {
  if (!isRecord(value)) return '';
  const strings: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) if (typeof entry === 'string') strings[key] = entry;
  return getLocalizedString(strings, locale);
};

/** Every reader returns `undefined` (or `[]` for sets) for a missing or wrongly typed attribute; none ever throws. */
export function attrNumber(attrs: Attrs, name: string): number | undefined {
  const value = raw(attrs, name);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
export function attrString(attrs: Attrs, name: string): string | undefined {
  const value = raw(attrs, name);
  return typeof value === 'string' ? value : undefined;
}
export function attrBool(attrs: Attrs, name: string): boolean | undefined {
  const value = raw(attrs, name);
  return typeof value === 'boolean' ? value : undefined;
}
/** Enum and localized enum: only the key is used (the label is never read). */
export function attrEnumKey(attrs: Attrs, name: string): string | undefined {
  const value = raw(attrs, name);
  return isRecord(value) && typeof value.key === 'string' ? value.key : undefined;
}
export function attrEnumKeys(attrs: Attrs, name: string): string[] {
  const value = raw(attrs, name);
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => (isRecord(entry) && typeof entry.key === 'string' ? [entry.key] : []));
}
export function attrStringSet(attrs: Attrs, name: string): string[] {
  const value = raw(attrs, name);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}
export function attrLocalized(attrs: Attrs, name: string, locale: string): string | undefined {
  const value = raw(attrs, name);
  return isRecord(value) ? localizedOf(value, locale) : undefined;
}
/** A set of localized strings (`highlights`): `[{ 'en-US': …, 'de-DE': … }, …]`. */
export function attrLocalizedSet(attrs: Attrs, name: string, locale: string): string[] {
  const value = raw(attrs, name);
  if (!Array.isArray(value)) return [];
  return value.map((entry) => localizedOf(entry, locale)).filter((text) => text !== '');
}
/** ISO string (date and datetime attributes arrive as strings). */
export function attrDate(attrs: Attrs, name: string): string | undefined {
  const value = raw(attrs, name);
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;
}
