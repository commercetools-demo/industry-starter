'use client';
import useSWR from 'swr';
import { buKey, KEY_QUOTES } from '@/lib/cache-keys';
import { readJson, sendJson } from '@/lib/fetcher';
import type { QuoteThread, QuoteThreadDetail } from '@/lib/portal/types';
import { useAccount } from './useAccount';

/** Quote requests and quotes of the active Business Unit, one row per thread. Keyed `[KEY_QUOTES, businessUnitKey]`. */
export function useQuotes() {
  const { account, isLoading: accountLoading } = useAccount();
  const bu = account?.businessUnitKey;
  const { data, isLoading, mutate } = useSWR(bu ? buKey(KEY_QUOTES, bu) : null, () => readJson<{ threads: QuoteThread[] }>('/api/quotes'));
  return { threads: data?.threads ?? [], isLoading: accountLoading || isLoading, failed: !isLoading && !data && Boolean(bu), mutate };
}

/** One thread with its rounds and prices. Pass null to skip. */
export function useQuote(requestId: string | null) {
  const { account, isLoading: accountLoading } = useAccount();
  const bu = account?.businessUnitKey;
  const { data, isLoading, mutate } = useSWR(bu && requestId ? ([KEY_QUOTES, bu, requestId] as const) : null, () => readJson<{ thread: QuoteThreadDetail }>(`/api/quotes/${requestId}`));
  return { thread: data?.thread ?? null, isLoading: accountLoading || isLoading, failed: !isLoading && !data && Boolean(bu && requestId), mutate };
}

export type QuoteAction = 'accept' | 'decline' | 'renegotiate';

/** Throws SendError (the server's safe sentence) on failure. */
export const sendQuoteAction = (quoteId: string, action: QuoteAction, comment?: string) =>
  sendJson<{ thread: QuoteThreadDetail }>(`/api/quotes/${quoteId}/${action}`, 'POST', action === 'renegotiate' ? { comment } : undefined);

export const cancelQuoteRequest = (requestId: string) => sendJson<{ thread: QuoteThreadDetail }>(`/api/quote-requests/${requestId}/cancel`, 'POST');
