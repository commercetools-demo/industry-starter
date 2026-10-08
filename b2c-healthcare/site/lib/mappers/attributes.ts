import type { Attribute } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/utils';

/** Looks an attribute up by name on a variant's attribute list. */
export function findAttribute(attributes: Attribute[] | undefined, name: string): unknown {
  return attributes?.find((a) => a.name === name)?.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Text, localized text (`ltext`), or an enum/lenum value `{ key, label }`, resolved to a string for the locale. */
export function attrText(value: unknown, locale: string): string {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  if ('key' in value && 'label' in value) return attrText(value.label, locale) || String(value.key);
  return getLocalizedString(value as Record<string, string>, locale);
}

/** The enum key (not the label) of an enum/lenum value; plain strings pass through. */
export function attrEnumKey(value: unknown): string {
  if (typeof value === 'string') return value;
  return isRecord(value) && typeof value.key === 'string' ? value.key : '';
}

/** A set attribute (text or enum) as strings: enum entries yield their keys when `keys` is true. */
export function attrSet(value: unknown, locale: string, keys = false): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (keys ? attrEnumKey(v) : attrText(v, locale))).filter((s) => s.length > 0);
}

export function attrNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function attrBoolean(value: unknown): boolean {
  return value === true;
}
