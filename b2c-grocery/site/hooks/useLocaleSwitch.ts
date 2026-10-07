'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * Switches market: POST /api/locale (sets locale, currency and country atomically), then navigates to the same
 * page under the new locale prefix and refreshes server data. Does nothing on a failed POST.
 */
export function useLocaleSwitch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchLocale = useCallback(
    async (locale: string): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        // TODO(G-02 merged): use sendJson from lib/fetcher.ts (see plan/IDEAS.md).
        const response = await fetch('/api/locale', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        if (!response.ok) {
          setError('LOCALE_SWITCH_FAILED');
          return false;
        }
        const query = searchParams?.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { locale });
        router.refresh();
        return true;
      } catch {
        setError('LOCALE_SWITCH_FAILED');
        return false;
      } finally {
        setPending(false);
      }
    },
    [pathname, router, searchParams],
  );

  return { switchLocale, isPending, error };
}
