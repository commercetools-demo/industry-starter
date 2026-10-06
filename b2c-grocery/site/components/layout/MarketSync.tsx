'use client';

import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import { useRouter } from '@/i18n/routing';
import { sendJson } from '@/lib/fetcher';
import { LOCALE_COOKIE } from '@/lib/utils';

/**
 * Keeps the session market (currency, country, cart) in step with the URL locale (Q-ORCH-1, D-052).
 * The locale cookie is written by every market switch; when it differs from the page's locale (a direct visit,
 * a bookmark, a shared link) the same atomic endpoint is called once and server data is refreshed.
 * A currency change drops the cart, exactly as the header switch does. Renders nothing.
 */
export function MarketSync({ locale }: { locale: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const done = useRef<string | null>(null);

  useEffect(() => {
    const cookie = document.cookie.split('; ').find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.split('=')[1];
    if (cookie === locale || done.current === locale) return;
    done.current = locale;
    sendJson('/api/locale', 'POST', { locale })
      .then(() => {
        void mutate(KEY_CART); // the cart (and its currency) may have changed with the market
        router.refresh();
      })
      .catch(() => undefined);
  }, [locale, router, mutate]);

  return null;
}
