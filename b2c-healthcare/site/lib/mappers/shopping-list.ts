import type { ShoppingList, ShoppingListLineItem } from '@commercetools/platform-sdk';
import type { ListSummary } from '@/lib/lists-types';
import type { Money } from '@/lib/types';

/** Custom type of a list line (seed: `mlv-list-line`): the prescription reference and the price when saved. */
export const LIST_LINE_TYPE_KEY = 'mlv-list-line';
export const LIST_KEY_PREFIX = 'mlv-list-';
/** Lists are deleted by the platform this many days after the last change. */
export const LIST_DELETE_DAYS = 360;

export const listKeyOf = (id: string): string => `${LIST_KEY_PREFIX}${id}`;

export interface ListLineFields {
  rxNumber: string;
  rxLineRef: string;
  savedPrice: Money | null;
}

export function listLineFieldsOf(item: Pick<ShoppingListLineItem, 'custom'>): ListLineFields | null {
  const f = item.custom?.fields as Record<string, unknown> | undefined;
  if (!f || typeof f.rxNumber !== 'string' || typeof f.rxLineRef !== 'string') return null;
  const m = f.savedUnitPrice as { centAmount?: unknown; currencyCode?: unknown; fractionDigits?: unknown } | undefined;
  const savedPrice =
    m && typeof m.centAmount === 'number' && typeof m.currencyCode === 'string'
      ? { centAmount: m.centAmount, currencyCode: m.currencyCode, fractionDigits: typeof m.fractionDigits === 'number' ? m.fractionDigits : 2 }
      : null;
  return { rxNumber: f.rxNumber, rxLineRef: f.rxLineRef, savedPrice };
}

export const localizedName = (name: Record<string, string> | undefined, locale: string): string => (name ? (name[locale] ?? Object.values(name)[0] ?? '') : '');

export function mapListSummary(list: Pick<ShoppingList, 'id' | 'name' | 'lineItems' | 'lastModifiedAt'>, locale: string): ListSummary {
  return { id: list.id, name: localizedName(list.name, locale), lineCount: list.lineItems.length, updatedAt: list.lastModifiedAt };
}
