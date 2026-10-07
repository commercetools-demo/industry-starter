'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_ACCOUNT, KEY_ADDRESSES, KEY_CART, KEY_ORDERS, KEY_PROFILE, KEY_RECURRING, KEY_WISHLIST } from '@/lib/cache-keys';
import { fetchJson, sendJson } from '@/lib/fetcher';
import { useRouter } from '@/i18n/routing';
import type { AccountUser } from '@/lib/types';

type MeResponse = { user: AccountUser | null };

/** The signed-in shopper from the session cookie (seeded by the locale layout). `user` is `null` once loaded and when anonymous. */
export function useAccount() {
  const swr = useSWR<AccountUser | null>(KEY_ACCOUNT, async () => (await fetchJson<MeResponse>('/api/auth/me')).user, { revalidateOnFocus: true });
  return { ...swr, user: swr.data ?? null };
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * Sign in / register / sign out. On success login and register revalidate the account and the (merged) cart and refresh
 * the server components; logout also empties every per-customer cache. Failures throw `ApiError` (e.g. status 401
 * `INVALID_CREDENTIALS`, 409 `ACCOUNT_EXISTS`, 429 `RATE_LIMITED`) and leave the caches untouched.
 */
export function useAuthMutations() {
  const { mutate } = useSWRConfig();
  const router = useRouter();

  const signedIn = useCallback(async () => {
    await Promise.all([mutate(KEY_ACCOUNT), mutate(KEY_CART)]);
    router.refresh();
  }, [mutate, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      await sendJson('/api/auth/login', 'POST', { email, password });
      await signedIn();
    },
    [signedIn],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await sendJson('/api/auth/register', 'POST', input);
      await signedIn();
    },
    [signedIn],
  );

  /** The reset route signs the customer in on success (anonymous cart merged). */
  const resetPassword = useCallback(
    async (token: string, password: string) => {
      await sendJson('/api/auth/reset-password', 'POST', { token, password });
      await signedIn();
    },
    [signedIn],
  );

  const logout = useCallback(async () => {
    await sendJson('/api/auth/logout', 'POST');
    await Promise.all([
      mutate(KEY_ACCOUNT, null, { revalidate: false }),
      mutate(KEY_CART, null, { revalidate: false }),
      ...[KEY_ORDERS, KEY_PROFILE, KEY_ADDRESSES, KEY_WISHLIST, KEY_RECURRING].map((key) => mutate(key, undefined, { revalidate: false })),
    ]);
    // Per-order caches (`order:<id>`), later order list pages (`orders:<n>`) and the saved products (`wishlist:products:<locale>`) are keyed dynamically: drop them all.
    await mutate(
      (key) => typeof key === 'string' && (key.startsWith('order:') || key.startsWith('orders:') || key.startsWith('wishlist:')),
      undefined,
      { revalidate: false },
    );
    router.refresh();
  }, [mutate, router]);

  return useMemo(() => ({ login, register, resetPassword, logout }), [login, register, resetPassword, logout]);
}
