'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Client data of Account settings (workstream U-10). The customer is always the session's; no id is ever sent from here.
import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useViewer } from '@/context/ViewerContext';
import type { AccountAddressInput, AccountProfileInput } from '@/lib/company/schemas';
import type { AccountAddress, AccountProfile, AccountUnitRow } from '@/lib/company/types';
import { postJson, swrFetcher, type ApiResult } from './http';
import { sendJson } from './sellerHttp';

const base = '/api/account';

export function useAccountProfile() {
  const { customerId } = useViewer();
  return useSWR<{ profile: AccountProfile }>(['account-profile', customerId], () => swrFetcher<{ profile: AccountProfile }>(`${base}/profile`), { revalidateOnFocus: false });
}

export function useAccountAddresses() {
  const { customerId } = useViewer();
  return useSWR<{ addresses: AccountAddress[] }>(['account-addresses', customerId], () => swrFetcher<{ addresses: AccountAddress[] }>(`${base}/addresses`), { revalidateOnFocus: false });
}

export function useAccountUnits() {
  const { customerId } = useViewer();
  return useSWR<{ units: AccountUnitRow[] }>(['account-units', customerId], () => swrFetcher<{ units: AccountUnitRow[] }>(`${base}/business-units`), { revalidateOnFocus: false });
}

export function useAccountActions() {
  const { customerId } = useViewer();
  const { mutate } = useSWRConfig();
  const refresh = useCallback((name: string) => mutate((key) => Array.isArray(key) && key[0] === name && key[1] === customerId), [mutate, customerId]);
  return {
    saveProfile: async (input: AccountProfileInput): Promise<ApiResult<{ profile: AccountProfile }>> => {
      const result = await sendJson<{ profile: AccountProfile }>('PUT', `${base}/profile`, input);
      if (result.ok) await refresh('account-profile');
      return result;
    },
    changePassword: (currentPassword: string, newPassword: string): Promise<ApiResult<{ status: string }>> => sendJson('PUT', `${base}/password`, { currentPassword, newPassword }),
    addAddress: async (input: AccountAddressInput): Promise<ApiResult<{ addresses: AccountAddress[] }>> => {
      const result = await postJson<{ addresses: AccountAddress[] }>(`${base}/addresses`, input);
      if (result.ok) await refresh('account-addresses');
      return result;
    },
    removeAddress: async (id: string): Promise<ApiResult<{ addresses: AccountAddress[] }>> => {
      const result = await sendJson<{ addresses: AccountAddress[] }>('DELETE', `${base}/addresses/${encodeURIComponent(id)}`);
      if (result.ok) await refresh('account-addresses');
      return result;
    },
    makeDefault: async (id: string): Promise<ApiResult<{ addresses: AccountAddress[] }>> => {
      const result = await postJson<{ addresses: AccountAddress[] }>(`${base}/addresses/${encodeURIComponent(id)}/default`);
      if (result.ok) await refresh('account-addresses');
      return result;
    },
  };
}

/** The accept-invite call (no session yet): used by the accept-invite page only. */
export const acceptInviteApi = (token: string, password: string): Promise<ApiResult<{ status: string }>> => postJson(`/api/auth/accept-invite`, { token, password });
