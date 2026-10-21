import { bundleOffered } from '@/lib/product/compatibility';
import type { SelectorDef, VariantView } from '@/lib/types';

/** Selected value per selector attribute (enum key or the number as text); a missing key is unselected. */
export type Selection = Record<string, string | undefined>;

const matches = (v: VariantView, selection: Selection, skip?: string): boolean =>
  Object.entries(selection).every(([attr, value]) => value === undefined || attr === skip || String(v.attrs[attr]) === value);

/**
 * The variant whose attributes equal every selected value, or null while a required attribute is unselected or no variant
 * matches. `required` lists the attribute names that must be selected (the selectors the product shows). Exported for I and O.
 */
export function resolveVariant(variants: VariantView[], selection: Selection, required: readonly string[] = []): VariantView | null {
  if (required.some((attr) => selection[attr] === undefined)) return null;
  return variants.find((v) => matches(v, selection)) ?? null;
}

/** First unselected required selector, or undefined when the selection is complete. */
export function firstMissing(selectors: SelectorDef[], selection: Selection): SelectorDef | undefined {
  return selectors.find((s) => s.required && selection[s.attr] === undefined);
}

export type OptionReason = 'noVariant' | 'bundleNotForMachine' | 'noPrice' | 'notAvailableForCollection';
export interface OptionState { value: string; disabled: boolean; reason?: OptionReason }

export interface OptionContext {
  fulfilment: 'delivery' | 'collect' | 'subscribe';
  /** Channel id of the chosen store (collect only). */
  storeChannelId?: string;
  /** Machine `system` enum key, for the bundle rule. */
  systemKey?: string;
}

/**
 * State of every option of one selector, computed from the variants that match the other selections. Disabled when no
 * such variant exists, when the bundle does not suit the machine, when none has a price, or when collecting and every one
 * is out at the chosen store. Out of stock online never disables an option (the add button says so).
 */
export function optionStates(
  variants: VariantView[],
  selection: Selection,
  selector: SelectorDef,
  ctx: OptionContext,
): OptionState[] {
  return selector.options.map(({ value }): OptionState => {
    const candidates = variants.filter((v) => matches(v, selection, selector.attr) && String(v.attrs[selector.attr]) === value);
    if (candidates.length === 0) return { value, disabled: true, reason: 'noVariant' };
    if (selector.attr === 'bundle' && !bundleOffered(ctx.systemKey, value)) return { value, disabled: true, reason: 'bundleNotForMachine' };
    if (candidates.every((v) => v.price === null)) return { value, disabled: true, reason: 'noPrice' };
    if (ctx.fulfilment === 'collect' && ctx.storeChannelId && candidates.every((v) => (v.stock.stores[ctx.storeChannelId as string] ?? 0) <= 0)) {
      return { value, disabled: true, reason: 'notAvailableForCollection' };
    }
    return { value, disabled: false };
  });
}
