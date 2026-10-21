import type { Attribute as SDKAttribute } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/utils';
import type { AttributeValue } from '@/lib/types';

type Scalar = string | number | boolean | { key: string; label: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mapScalar(value: unknown, locale: string): Scalar | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (!isRecord(value)) return undefined;
  // Reference, money and nested values are dropped, not invented.
  if ('typeId' in value || 'centAmount' in value || 'currencyCode' in value) return undefined;
  if (typeof value.key === 'string' && 'label' in value) {
    const label = value.label;
    if (typeof label === 'string') return { key: value.key, label };
    if (isRecord(label) && Object.values(label).every((x) => typeof x === 'string')) {
      return { key: value.key, label: getLocalizedString(label as Record<string, string>, locale) };
    }
    return undefined;
  }
  const entries = Object.values(value);
  if (entries.length > 0 && entries.every((x) => typeof x === 'string')) {
    return getLocalizedString(value as Record<string, string>, locale); // ltext
  }
  return undefined;
}

export function mapAttributes(attrs: SDKAttribute[] | undefined, locale: string): Record<string, AttributeValue> {
  const out: Record<string, AttributeValue> = {};
  for (const a of attrs ?? []) {
    const value: unknown = a.value;
    if (Array.isArray(value)) {
      const mapped = value.map((v) => mapScalar(v, locale));
      if (mapped.some((v) => v === undefined)) continue; // set of an unsupported type
      out[a.name] = mapped as Scalar[];
      continue;
    }
    const one = mapScalar(value, locale);
    if (one !== undefined) out[a.name] = one;
  }
  return out;
}
