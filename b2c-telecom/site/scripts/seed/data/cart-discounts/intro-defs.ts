// Cart Discount manifests generated from INTRO_DEFS (workstream L). One discount per introductory period: it makes the FIRST
// charge correct; the stored schedule (lib/pricing/schedule.ts) is the promise for the later periods (D-013).
// Docs: https://docs.commercetools.com/api/projects/cartDiscounts
import { INTRO_DEFS, type IntroDef } from '../../../../lib/config/pricing';
import { discountKeyFor } from '../../../../lib/pricing/introPeriod';
import type { CtApi } from '../../lib';
import type { CartDiscountDraft } from '../../types';

export interface IntroLookup {
  /** SKU of the variant with the offer's contract term. */
  sku: string;
  /** Standing recurring price in cents by currency. */
  standing: { USD: number; EUR: number };
}
export type LookupFn = (def: IntroDef) => Promise<IntroLookup>;

/** Sort orders are unique in the project; 0.1 to 0.6 belong to G's discounts. */
const SORT_ORDER_BASE = 70;

const slugOf = (def: IntroDef): string => def.offerKey.replace(/^malva-offer-/, '');
const termKey = (term: number): string => (term === 0 ? 'month-to-month' : `${term}-months`);

export function introManifest(def: IntroDef, lookup: IntroLookup, index: number): CartDiscountDraft {
  const money = (['USD', 'EUR'] as const).map((currencyCode) => {
    const delta = lookup.standing[currencyCode] - def.amountCents[currencyCode];
    if (delta <= 0) throw new Error(`Introductory amount of ${def.offerKey} is not below the standing price in ${currencyCode}`);
    return { currencyCode, centAmount: delta };
  });
  const termLabel = def.term === 0 ? 'month-to-month' : `${def.term}-month term`;
  return {
    key: discountKeyFor(def),
    name: {
      'en-US': `Introductory price: ${slugOf(def)}, first ${def.months} months`,
      'de-DE': `Einführungspreis: ${slugOf(def)}, erste ${def.months} Monate`,
    },
    description: {
      'en-US': `Reduced monthly price for the first ${def.months} months of the ${termLabel}. The schedule on the order states the later periods.`,
      'de-DE': `Reduzierter Monatspreis für die ersten ${def.months} Monate (${def.term === 0 ? 'monatlich kündbar' : `${def.term} Monate Laufzeit`}). Die späteren Zeiträume stehen im Preisplan der Bestellung.`,
    },
    value: { type: 'absolute', money },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: `sku = "${lookup.sku}"` },
    sortOrder: `0.${SORT_ORDER_BASE + index + 1}`,
    stackingMode: 'Stacking',
    requiresDiscountCode: false,
    isActive: true,
    recurringOrderScope: { type: 'AnyOrder' },
  };
}

/** The manifests of all definitions; no validFrom/validUntil (the period belongs to the customer, not to the campaign). */
export async function buildIntroManifests(lookup: LookupFn, defs: IntroDef[] = INTRO_DEFS): Promise<CartDiscountDraft[]> {
  const out: CartDiscountDraft[] = [];
  for (const [index, def] of defs.entries()) out.push(introManifest(def, await lookup(def), index));
  return out;
}

interface RawPrice {
  value?: { centAmount?: number; currencyCode?: string };
  country?: string;
  recurrencePolicy?: unknown;
  channel?: unknown;
  customerGroup?: unknown;
}
interface RawVariant {
  sku?: string;
  attributes?: { name: string; value: unknown }[];
  prices?: RawPrice[];
}

const COUNTRY_OF = { USD: 'US', EUR: 'DE' } as const;

function enumKey(value: unknown): string {
  return typeof value === 'object' && value !== null ? String((value as { key?: unknown }).key ?? '') : String(value ?? '');
}

/** Reads the offer's product projection with the admin client and finds the term variant and its recurring prices. Fails loudly. */
export function apiLookup(api: CtApi): LookupFn {
  return async (def) => {
    const projection = (await api.get(`product-projections/key=${def.offerKey}`, { staged: 'false' })) as { masterVariant?: RawVariant; variants?: RawVariant[] } | null;
    if (!projection) throw new Error(`Offer ${def.offerKey} not found: run the seed first`);
    const variants = [projection.masterVariant, ...(projection.variants ?? [])].filter((v): v is RawVariant => Boolean(v));
    const variant = variants.find((v) => enumKey(v.attributes?.find((a) => a.name === 'contract-term')?.value) === termKey(def.term));
    if (!variant?.sku) throw new Error(`Offer ${def.offerKey} has no variant for ${termKey(def.term)}`);
    const standing = {} as IntroLookup['standing'];
    for (const currency of ['USD', 'EUR'] as const) {
      const price = (variant.prices ?? []).find(
        (p) => p.recurrencePolicy && !p.channel && !p.customerGroup && p.value?.currencyCode === currency && (p.country === undefined || p.country === COUNTRY_OF[currency]),
      );
      if (price?.value?.centAmount === undefined) throw new Error(`Variant ${variant.sku} has no recurring ${currency} price`);
      standing[currency] = price.value.centAmount;
    }
    return { sku: variant.sku, standing };
  };
}
