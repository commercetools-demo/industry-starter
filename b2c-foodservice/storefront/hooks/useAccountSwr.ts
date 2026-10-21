'use client';

import { useCallback, useEffect } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';
import { ApiError, fetchJson } from '@/hooks/fetcher';
import { usePathname, useRouter } from '@/i18n/routing';
import { signInHref } from '@/lib/routes';

/**
 * Sends the shopper to sign-in, keeping the current account page as the destination. Used when a call answers 401: the
 * session expired while the page was open.
 */
export function useSessionExpired(): (error: unknown) => boolean {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(signInHref(pathname));
        return true;
      }
      return false;
    },
    [router, pathname],
  );
}

/**
 * SWR for an account panel: the fetcher is `fetchJson(url)`, a 401 sends the shopper to sign-in (the destination is the
 * current path), every other failure stays in `error` so the panel can show its own unavailable state.
 */
export function useAccountSwr<T>(
  key: readonly unknown[] | null,
  url: string,
  config: SWRConfiguration<T, ApiError> = {},
) {
  const expired = useSessionExpired();
  const result = useSWR<T, ApiError>(key, () => fetchJson<T>(url), { revalidateOnFocus: false, ...config });
  const { error } = result;
  useEffect(() => {
    if (error) expired(error);
  }, [error, expired]);
  return result;
}
