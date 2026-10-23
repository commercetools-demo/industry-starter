import type { AttributeType, ProductType } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/utils';

/** attribute name -> enum key -> label in the display locale. */
export type AttributeLabels = Record<string, Record<string, string>>;

function enumValues(type: AttributeType): Array<{ key: string; label: string | Record<string, string> }> {
  if (type.name === 'enum' || type.name === 'lenum') return type.values as never;
  if (type.name === 'set') return enumValues(type.elementType);
  return [];
}

/** Enum and lenum (also inside a set) labels of every product type. The first definition of a name wins per key. */
export function mapAttributeLabels(types: ProductType[], locale: string): AttributeLabels {
  const out: AttributeLabels = {};
  for (const pt of types) {
    for (const attr of pt.attributes ?? []) {
      for (const v of enumValues(attr.type)) {
        const bucket = (out[attr.name] ??= {});
        if (bucket[v.key] !== undefined) continue;
        bucket[v.key] = typeof v.label === 'string' ? v.label : getLocalizedString(v.label, locale);
      }
    }
  }
  return out;
}
