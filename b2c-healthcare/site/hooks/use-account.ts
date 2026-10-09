'use client';
import useSWR, { type SWRResponse } from 'swr';
import { API_AUTH_ME } from '@/lib/api-paths';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import type { AccountUser } from '@/lib/types';

/** `GET /api/auth/me`: the minimal user, or `null` when signed out. */
export async function fetchAccount(): Promise<AccountUser | null> {
  const response = await fetch(API_AUTH_ME);
  if (!response.ok) throw new Error(`account request failed (${response.status})`);
  return (await response.json()) as AccountUser | null;
}

/**
 * Signed-in user (`null` or undefined means signed out). The locale layout seeds the key from the session
 * (the user, or `null` for an anonymous visitor), so a first paint does not call the endpoint; without
 * seeded data it asks `/api/auth/me` once. Sign-in, registration and sign-out write the key themselves
 * (`useAuth`), so there is no revalidation on focus or when stale.
 */
export function useAccount(): SWRResponse<AccountUser | null> {
  return useSWR<AccountUser | null>(KEY_ACCOUNT, fetchAccount, { revalidateIfStale: false, revalidateOnFocus: false });
}
