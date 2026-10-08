import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { loadRxFixtures } from '@/lib/ct/fixtures';
import { mapMedication } from '@/lib/mappers/medication';
import { shortDatedPriceOf } from '@/lib/ct/shelf-life';
import type { Medication, Money } from '@/lib/types';

export interface CatalogEntry {
  medication: Medication;
  /** Price on the `mlv-short-dated` channel in the visitor's currency, when the variant has one. */
  shortDatedPrice: Money | null;
}

export interface CatalogOptions {
  locale: string;
  currency: string;
  country: string;
}

/**
 * The medicines for a set of SKUs (one call): pack price, `maxQtyPerOrder`, `minRemainingShelfLifeDays`, and the
 * short-dated price. Prices depend on currency and country, so nothing here is cached across visitors.
 */
export async function getCatalogBySku(skus: string[], options: CatalogOptions): Promise<Map<string, CatalogEntry>> {
  const out = new Map<string, CatalogEntry>();
  const unique = [...new Set(skus)].filter((s) => /^[\w.-]+$/.test(s));
  if (unique.length === 0) return out;

  const fixtures = await loadRxFixtures();
  if (fixtures) {
    for (const sku of unique) {
      const medication = fixtures.fixtureMedicineBySku(sku);
      if (medication) out.set(sku, { medication, shortDatedPrice: null });
    }
    return out;
  }

  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `masterVariant(sku in (${unique.map((s) => `"${s}"`).join(', ')}))`,
        priceCurrency: options.currency,
        priceCountry: options.country,
        expand: 'masterVariant.prices[*].channel',
        limit: 500,
      },
    })
    .execute();
  for (const projection of body.results) {
    const medication = mapMedication(projection, { locale: options.locale, currency: options.currency });
    if (!medication.sku) continue;
    out.set(medication.sku, { medication, shortDatedPrice: shortDatedPriceOf(projection.masterVariant.prices, options.currency) });
  }
  return out;
}
