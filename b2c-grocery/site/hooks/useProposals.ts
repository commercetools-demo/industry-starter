'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { keyProposals } from '@/lib/cache-keys';
import { ApiError, fetchJson, sendJson } from '@/lib/fetcher';
import type { ProposalsResponse } from '@/lib/types';

const retryable = (error: unknown): boolean => !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/**
 * Pending substitution proposals of an order and the lines with a declined proposal. Safe defaults: none.
 * `accept` / `decline` throw `ApiError` (409 `STALE`, 422 `NOT_EDITABLE`, ...) and refetch the proposals on success.
 */
export function useProposals(orderId: string) {
  const swr = useSWR<ProposalsResponse>(
    keyProposals(orderId),
    async () => {
      const data = await fetchJson<Partial<ProposalsResponse>>(`/api/account/orders/${encodeURIComponent(orderId)}/proposals`);
      return {
        proposals: Array.isArray(data.proposals) ? data.proposals : [],
        removalRequested: Array.isArray(data.removalRequested) ? data.removalRequested : [],
      };
    },
    { shouldRetryOnError: retryable },
  );
  const { mutate } = swr;

  const accept = useCallback(
    async (editId: string) => {
      await sendJson(`/api/account/proposals/${encodeURIComponent(editId)}/accept`, 'POST');
      await mutate();
    },
    [mutate],
  );
  const decline = useCallback(
    async (editId: string) => {
      await sendJson(`/api/account/proposals/${encodeURIComponent(editId)}/decline`, 'POST');
      await mutate();
    },
    [mutate],
  );

  return { ...swr, proposals: swr.data?.proposals ?? [], removalRequested: swr.data?.removalRequested ?? [], accept, decline };
}
