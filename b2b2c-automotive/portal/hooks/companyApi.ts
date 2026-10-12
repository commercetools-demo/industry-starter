'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Client data of Company & team (workstream U-09). SWR keys are `[name, businessUnitKey]` tuples so a unit switch refreshes them.
// The unit always comes from the session on the server; nothing here sends a unit or customer id.
import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useViewer } from '@/context/ViewerContext';
import type { AddressInput, InviteInput, ProfileInput } from '@/lib/company/schemas';
import type { AddressRow, InviteResult, ProfileView, RoleOption, UserRow } from '@/lib/company/types';
import { postJson, swrFetcher, type ApiResult } from './http';
import { sendJson } from './sellerHttp';

const base = '/api/company';

export function useCompanyUsers() {
  const { businessUnitKey } = useViewer();
  return useSWR<{ users: UserRow[] }>(['company-users', businessUnitKey], () => swrFetcher<{ users: UserRow[] }>(`${base}/users`), { revalidateOnFocus: false });
}

export function useCompanyRoles() {
  const { businessUnitKey } = useViewer();
  return useSWR<{ roles: RoleOption[] }>(['company-roles', businessUnitKey], () => swrFetcher<{ roles: RoleOption[] }>(`${base}/roles`), { revalidateOnFocus: false });
}

export function useCompanyAddresses() {
  const { businessUnitKey } = useViewer();
  return useSWR<{ addresses: AddressRow[] }>(['company-addresses', businessUnitKey], () => swrFetcher<{ addresses: AddressRow[] }>(`${base}/addresses`), { revalidateOnFocus: false });
}

export function useCompanyProfile() {
  const { businessUnitKey } = useViewer();
  return useSWR<{ profile: ProfileView }>(['company-profile', businessUnitKey], () => swrFetcher<{ profile: ProfileView }>(`${base}/profile`), { revalidateOnFocus: false });
}

/** The writes of the Company screens; each refreshes the matching read. */
export function useCompanyActions() {
  const { businessUnitKey } = useViewer();
  const { mutate } = useSWRConfig();
  const refresh = useCallback((name: string) => mutate((key) => Array.isArray(key) && key[0] === name && key[1] === businessUnitKey), [mutate, businessUnitKey]);
  return {
    invite: async (input: InviteInput): Promise<ApiResult<InviteResult>> => {
      const result = await postJson<InviteResult>(`${base}/users/invite`, input);
      if (result.ok) await refresh('company-users');
      return result;
    },
    addAddress: async (input: AddressInput): Promise<ApiResult<{ addresses: AddressRow[] }>> => {
      const result = await postJson<{ addresses: AddressRow[] }>(`${base}/addresses`, input);
      if (result.ok) await refresh('company-addresses');
      return result;
    },
    makeDefault: async (addressId: string): Promise<ApiResult<{ addresses: AddressRow[] }>> => {
      const result = await postJson<{ addresses: AddressRow[] }>(`${base}/addresses/default`, { addressId });
      if (result.ok) await refresh('company-addresses');
      return result;
    },
    saveProfile: async (input: ProfileInput): Promise<ApiResult<{ profile: ProfileView }>> => {
      const result = await sendJson<{ profile: ProfileView }>('PUT', `${base}/profile`, input);
      if (result.ok) await refresh('company-profile');
      return result;
    },
  };
}
