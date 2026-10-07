'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { usePathname, useRouter } from '@/i18n/routing';
import type { Market } from '@/lib/utils';

export type SwitchMarketResult = {
  locale: string;
  currency: string;
  country: string;
  cart: { action: 'none' | 'discarded'; droppedLines: { offerKey: string; name: string }[] };
};

/** Switches region and language; the caller shows the toast from the returned result (`region.cartEmptied` or `region.switched`). */
export function useSwitchMarket(): { switchMarket: (locale: Market['locale']) => Promise<SwitchMarketResult>; pending: boolean } {
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  const switchMarket = useCallback(
    async (locale: Market['locale']): Promise<SwitchMarketResult> => {
      setPending(true);
      try {
        const response = await fetch('/api/locale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        if (!response.ok) throw new Error('region.error');
        const result = (await response.json()) as SwitchMarketResult;
        await mutate(() => true, undefined, { revalidate: true });
        const query = searchParams.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { locale });
        router.refresh();
        return result;
      } finally {
        setPending(false);
      }
    },
    [mutate, pathname, router, searchParams],
  );

  return { switchMarket, pending };
}
