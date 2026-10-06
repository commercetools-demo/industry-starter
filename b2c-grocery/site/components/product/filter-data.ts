import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { listingHref, withListingChange, type ListingParams } from '@/lib/listing-params';
import type { ListingFilterData } from '@/lib/listing-view';
import { formatMoney } from '@/lib/utils';

export type { ListingFilterData };

export type FilterPatch = Partial<Pick<ListingParams, 'category' | 'price' | 'stock' | 'sort'>>;

/** Locale-aware navigation for filter changes: page resets to 1, everything else stays in the URL. */
export function useListingNavigation(params: ListingParams, onNavigate?: () => void) {
  const router = useRouter();
  return {
    apply(patch: FilterPatch) {
      router.replace(listingHref(withListingChange(params, patch)));
      onNavigate?.();
    },
    clearAll() {
      router.replace('/shop');
      onNavigate?.();
    },
  };
}

/** Label of a price band built from the `plp.band.*` templates and `formatMoney` ("Under $5.00", "$5.00–$15.00"). */
export function usePriceBandLabel(currency: string) {
  const t = useTranslations('plp.band');
  const locale = useLocale();
  return (band: { min?: number; max?: number }): string => {
    const money = (cents: number) => formatMoney(cents, currency, locale);
    if (band.min === undefined && band.max !== undefined) return t('under', { max: money(band.max) });
    if (band.min !== undefined && band.max === undefined) return t('over', { min: money(band.min) });
    if (band.min !== undefined && band.max !== undefined) return t('range', { min: money(band.min), max: money(band.max) });
    return t('any');
  };
}
