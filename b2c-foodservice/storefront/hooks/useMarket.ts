'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { fetchJson } from '@/hooks/fetcher';
import { usePathname, useRouter } from '@/i18n/routing';
import { marketForLocale } from '@/lib/utils';

export interface MarketSwitchResult {
  country: string; currency: string; locale: string;
  cartCarriedOver: boolean; droppedLines: string[];
}

/**
 * The current market (from the route locale) and the one-step switch, for the locale chooser and any page that needs it.
 * `switchCountry` calls PUT /api/session/market, then replaces the route locale and refreshes server data, so every
 * page re-reads currency from the session. It rejects with ApiError when the server refuses the market.
 */
export function useMarket() {
  const locale = useLocale();
  const market = marketForLocale(locale);
  const router = useRouter();
  const pathname = usePathname();

  const switchCountry = useCallback(
    async (country: string): Promise<MarketSwitchResult> => {
      const result = await fetchJson<MarketSwitchResult>('/api/session/market', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country }),
      });
      const search = typeof window === 'undefined' ? '' : window.location.search;
      router.replace(`${pathname}${search}`, { locale: result.locale });
      router.refresh();
      return result;
    },
    [router, pathname],
  );

  return { country: market.country, currency: market.currency, locale: market.locale, switchCountry };
}
