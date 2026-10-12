// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale } from 'next-intl';
import useSWR from 'swr';
import { fetchJson } from '@/hooks/fetch-json';
import { keySubscriptionPolicies } from '@/lib/cache-keys';
import type { PolicyOption } from '@/lib/types';

/** The recurrence policies of "Subscribe and save" (`GET /api/subscriptions/policies`); `enabled` false skips the request. */
export function useSubscriptionPolicies(enabled: boolean): { policies: PolicyOption[]; isLoading: boolean; failed: boolean } {
  const locale = useLocale();
  const { data, isLoading, error } = useSWR<{ policies: PolicyOption[] }>(enabled ? keySubscriptionPolicies(locale) : null, fetchJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return { policies: data?.policies ?? [], isLoading, failed: Boolean(error) };
}
