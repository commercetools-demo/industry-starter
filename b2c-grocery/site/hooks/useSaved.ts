'use client';

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import useSWR, { useSWRConfig } from 'swr';
import { useAccount } from '@/hooks/useAccount';
import { usePathname, useRouter } from '@/i18n/routing';
import { KEY_ACCOUNT, KEY_WISHLIST } from '@/lib/cache-keys';
import { ApiError, fetchJson, sendJson } from '@/lib/fetcher';
import { safeRedirectPath } from '@/lib/safe-redirect';

export interface UseSaved {
  isSaved(productId: string): boolean;
  toggle(productId: string): Promise<void>;
}

/** `sessionStorage` key written before an anonymous heart click leaves for sign-in (read by `PendingSaveRunner`). */
export const PENDING_SAVE_KEY = 'pendingSave';
/** Query parameter that carries the product id through sign-in and back. */
export const SAVE_PARAM = 'save';

type WishlistResponse = { productIds: string[] };
const fetchIds = async () => (await fetchJson<WishlistResponse>('/api/account/wishlist')).productIds;

/** `searchParams` with `save=<productId>` set (replacing an older one). */
export function withSaveParam(search: string, productId: string): string {
  const params = new URLSearchParams(search);
  params.set(SAVE_PARAM, productId);
  return `?${params.toString()}`;
}

/** Add `productId` to the saved ids once (the server is idempotent too). Used by the heart and by `PendingSaveRunner`. */
export function useWishlistMutations() {
  const { mutate } = useSWRConfig();
  const save = useCallback(
    (productId: string) =>
      mutate(KEY_WISHLIST, async (ids?: string[]) => (await sendJson<WishlistResponse>('/api/account/wishlist', 'POST', { productId })).productIds ?? ids, {
        optimisticData: (ids?: string[]) => (ids?.includes(productId) ? ids : [productId, ...(ids ?? [])]),
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }),
    [mutate],
  );
  const unsave = useCallback(
    (productId: string) =>
      mutate(KEY_WISHLIST, async () => (await sendJson<WishlistResponse>(`/api/account/wishlist/${encodeURIComponent(productId)}`, 'DELETE')).productIds, {
        optimisticData: (ids?: string[]) => (ids ?? []).filter((id) => id !== productId),
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }),
    [mutate],
  );
  return useMemo(() => ({ save, unsave }), [save, unsave]);
}

/**
 * Heart state and toggle. The state comes from SWR (client-resolved per session, never from props or cached markup).
 * Signed in: the heart flips at once and rolls back if the server refuses. Anonymous: nothing is saved yet; the
 * product id is remembered and the shopper is sent to sign-in with a `redirect` back to this page carrying
 * `?save=<productId>`, where `PendingSaveRunner` completes the save.
 */
export function useSaved(): UseSaved {
  const { user, data: account } = useAccount();
  const signedIn = user !== null;
  const { data } = useSWR<string[]>(signedIn ? KEY_WISHLIST : null, fetchIds, { revalidateOnFocus: false });
  const { mutate } = useSWRConfig();
  const { save, unsave } = useWishlistMutations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const ids = data;

  const isSaved = useCallback((productId: string) => (signedIn && ids?.includes(productId)) ?? false, [signedIn, ids]);

  const goToSignIn = useCallback(
    (productId: string) => {
      sessionStorage.setItem(PENDING_SAVE_KEY, productId);
      const search = typeof window === 'undefined' ? '' : window.location.search;
      const back = safeRedirectPath(`/${locale}${pathname === '/' ? '/' : pathname}${withSaveParam(search, productId)}`, locale);
      router.push(`/account/sign-in?redirect=${encodeURIComponent(back)}&${SAVE_PARAM}=${encodeURIComponent(productId)}`);
    },
    [locale, pathname, router],
  );

  const toggle = useCallback(
    async (productId: string) => {
      if (!signedIn) {
        if (account === undefined) return; // account not resolved yet: do not guess
        goToSignIn(productId);
        return;
      }
      try {
        await (isSaved(productId) ? unsave(productId) : save(productId));
      } catch (e) {
        // The optimistic value is already rolled back. A 401 means the session ended: behave like a visitor.
        if (e instanceof ApiError && e.status === 401) {
          await mutate(KEY_ACCOUNT, null, { revalidate: false });
          goToSignIn(productId);
        }
      }
    },
    [signedIn, account, isSaved, save, unsave, mutate, goToSignIn],
  );

  return useMemo(() => ({ isSaved, toggle }), [isSaved, toggle]);
}
