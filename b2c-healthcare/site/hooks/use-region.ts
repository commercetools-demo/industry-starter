'use client';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { usePathname, useRouter } from '@/i18n/routing';
import { API_LOCALE } from '@/lib/api-paths';
import { KEY_CART, KEY_CART_DETAILS } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/http';

/** What `POST /api/locale` answers. `cartCleared` is true when the session's cart was dropped (currency changed). */
export interface RegionSwitchResult {
  locale: string;
  country: string;
  currency: string;
  cartCleared: boolean;
}

/**
 * Switches region: one `POST /api/locale` (locale, country and currency change together on the server), then
 * the cart caches are emptied when the server dropped the cart (with an explicit toast) and the same page is
 * opened under the new locale prefix. Returns `{ switching, switchTo }`; `switchTo` never throws (a failure
 * shows a toast and stays on the page).
 */
export function useSwitchRegion(): { switching: boolean; switchTo: (locale: string) => Promise<void> } {
  const t = useTranslations('region');
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [switching, setSwitching] = useState(false);

  const switchTo = useCallback(
    async (locale: string) => {
      setSwitching(true);
      try {
        const result = await fetchJson<RegionSwitchResult>(API_LOCALE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        if (result.cartCleared) {
          await Promise.all([KEY_CART, KEY_CART_DETAILS].map((key) => mutate(key, null, { revalidate: false })));
          toast.show({ message: t('cartEmptied') });
        }
        // Same page, new locale prefix; the server components re-render with the new session region.
        router.replace(`${pathname}${window.location.search}`, { locale });
        router.refresh();
      } catch {
        toast.show({ message: t('failed') });
      } finally {
        setSwitching(false);
      }
    },
    [mutate, pathname, router, t, toast],
  );

  return { switching, switchTo };
}
