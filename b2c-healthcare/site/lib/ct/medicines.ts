import 'server-only';
import { cache } from 'react';
import { apiRoot } from '@/lib/ct/client';
import { loadFixtures } from '@/lib/ct/fixtures';
import { getSupplyBySku, shortDatedPriceOf } from '@/lib/ct/shelf-life';
import { todayIso } from '@/lib/dispense/rules';
import { mapMedication } from '@/lib/mappers/medication';
import { assessAvailability } from '@/lib/medicine-availability';
import type { MedicineAvailability, MedicineDetail } from '@/lib/types';

const SAFE_KEY = /^mlv-med-[a-z0-9-]{1,90}$/;

/**
 * One medicine by product key, or null when it does not exist (or is not a medicine key). Public catalog data only: the same for
 * every visitor of a region, so nothing about the patient is read. Prices depend on currency/country, so it is not put in a shared
 * cache; `getMedicineByKeyCached` de-duplicates it inside one request (`generateMetadata` + the page). A failing stock read hides
 * the stock line, it does not fail the page.
 */
export async function getMedicineByKey(
  key: string,
  ctx: { locale: string; currency: string; country: string },
  now: Date = new Date(),
): Promise<MedicineDetail | null> {
  if (!SAFE_KEY.test(key)) return null;
  const fx = await loadFixtures();
  if (fx) return fx.fixtureMedicineDetail(key, now);
  let projection;
  try {
    ({ body: projection } = await apiRoot
      .productProjections()
      .withKey({ key })
      .get({ queryArgs: { priceCurrency: ctx.currency, priceCountry: ctx.country, expand: ['masterVariant.prices[*].channel'] } })
      .execute());
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
  const medicine = mapMedication(projection, { locale: ctx.locale, currency: ctx.currency });
  let availability: MedicineAvailability | null = null;
  if (medicine.sku) {
    try {
      const supply = (await getSupplyBySku([medicine.sku])).get(medicine.sku);
      availability = assessAvailability({
        supply,
        minRemainingShelfLifeDays: medicine.minRemainingShelfLifeDays,
        shortDatedPrice: shortDatedPriceOf(projection.masterVariant.prices, ctx.currency),
        today: todayIso(now),
      });
    } catch {
      availability = null;
    }
  }
  return { ...medicine, imageUrls: (projection.masterVariant.images ?? []).map((i) => i.url), availability };
}

/** Request-scoped memo (arguments are primitives so React `cache` can match them). */
export const getMedicineByKeyCached = cache((key: string, locale: string, currency: string, country: string) =>
  getMedicineByKey(key, { locale, currency, country }),
);
