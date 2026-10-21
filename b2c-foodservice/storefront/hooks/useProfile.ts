'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { KEY_ACCOUNT, keyAddresses, keyProfile } from '@/lib/cache-keys';
import type { AccountProfile } from '@/lib/types';

export interface ProfileWrite { firstName?: string; lastName?: string; phone?: string; defaultShippingAddressId?: string }

const send = <T,>(url: string, method: string, body: unknown): Promise<T> =>
  fetchJson<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** The profile card's data, save, and the password change (`ApiError` codes: `password_policy` with `extra.failed`, `current_password_invalid`, `rate_limited`). */
export function useProfile() {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, mutate: reload } = useAccountSwr<{ profile: AccountProfile }>(
    customerId ? keyProfile(customerId) : null,
    '/api/account/profile',
  );

  const save = useCallback(
    async (change: ProfileWrite) => {
      const res = await send<{ profile: AccountProfile }>('/api/account/profile', 'PATCH', change);
      if (!customerId) return;
      await mutate(keyProfile(customerId), res, { revalidate: false });
      // The greeting and the address book follow the saved names and default.
      void mutate(KEY_ACCOUNT);
      void mutate(keyAddresses(customerId));
    },
    [customerId, mutate],
  );

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) => send<{ ok: true }>('/api/account/password', 'POST', { currentPassword, newPassword }),
    [],
  );

  return { profile: data?.profile ?? null, isLoading, isError: Boolean(error), reload, save, changePassword };
}
