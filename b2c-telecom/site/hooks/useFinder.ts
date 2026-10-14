/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ApiError } from '@/lib/api-error';
import { fetchJson, sendJson } from '@/lib/fetcher';
import type { PreviewResult } from '@/lib/offers-api/preview';
import type { OfferDetail, OfferItem } from '@/lib/offers-api/views';
import type { BuyerContextView } from '@/app/api/buyer-context/route';
import type { CustomerType, ServiceLocation } from '@/lib/types';
import type { DraftExtra } from '@/lib/finder/draft';

// The plan finder's reads. Every one goes through a public endpoint (GET /api/offers, GET /api/offers/[key], POST /api/pricing/preview,
// GET /api/buyer-context), so the page can show nothing a documented endpoint would not return. A "context version" in each SWR key
// makes every read start again when the buyer changes customer type, existing-customer status or location.

const KEY_CONTEXT = '/api/buyer-context';

export const PLAN_KINDS: ReadonlySet<OfferItem['kind']> = new Set(['base-package', 'bundle']);

export const contextVersion = (context: BuyerContextView | undefined): string => (context ? `${context.customerType}|${context.existingCustomer}|${context.location?.postalCode ?? ''}` : '');

export function useBuyerContextView() {
  const { data, error, isLoading, mutate } = useSWR<BuyerContextView>(KEY_CONTEXT, () => fetchJson<{ context: BuyerContextView }>(KEY_CONTEXT).then((payload) => payload.context));
  return { context: data, error, isLoading, mutate };
}

export type ZipOutcome = { ok: true; location: ServiceLocation | null } | { ok: false; reason: 'invalid' | 'failed' };

/** Writes of the context bar. Each one refreshes the context (and with it every read keyed on its version). */
export function useBuyerContextActions(setPostalCode: (postalCode: string) => Promise<unknown>) {
  const { mutate } = useSWRConfig();
  const declare = useCallback(
    async (patch: { customerType?: CustomerType; existingCustomer?: 'yes' | 'no' | 'unspecified' }): Promise<boolean> => {
      try {
        const { context } = await sendJson<{ context: BuyerContextView }>(KEY_CONTEXT, 'POST', patch);
        // The cart's price depends on the declared group: read it again.
        await Promise.all([mutate(KEY_CONTEXT, context, { revalidate: false }), mutate('/api/cart')]);
        return true;
      } catch {
        return false;
      }
    },
    [mutate],
  );
  const enterZip = useCallback(
    async (postalCode: string): Promise<ZipOutcome> => {
      try {
        const { location } = await sendJson<{ location: ServiceLocation | null }>('/api/serviceability', 'POST', { postalCode });
        await setPostalCode(postalCode).catch(() => null);
        await mutate(KEY_CONTEXT);
        return { ok: true, location };
      } catch (error) {
        return { ok: false, reason: error instanceof ApiError && error.code === 'VALIDATION' ? 'invalid' : 'failed' };
      }
    },
    [mutate, setPostalCode],
  );
  const clearZip = useCallback(async (): Promise<boolean> => {
    try {
      await sendJson('/api/serviceability', 'POST', { postalCode: null });
      await mutate(KEY_CONTEXT);
      return true;
    } catch {
      return false;
    }
  }, [mutate]);
  return { declare, enterZip, clearZip };
}

export interface OffersPayload {
  offers: OfferItem[];
  total: number;
}

/** Every offer the buyer may see (the catalog is small), one read; the finder filters the plans of a family client-side. */
export function useFinderOffers(version: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OffersPayload>(version === null ? null : ['finder-offers', version], () => fetchJson<OffersPayload>('/api/offers?limit=100'));
  return { offers: data?.offers, error, isLoading, retry: () => void mutate() };
}

export function useOfferDetail(planKey: string | null, version: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OfferDetail>(planKey && version !== null ? ['finder-detail', planKey, version] : null, () => fetchJson<OfferDetail>(`/api/offers/${encodeURIComponent(planKey ?? '')}`));
  return { detail: data, error, isLoading, retry: () => void mutate() };
}

/** The price strip: dueToday and thenMonthly from the engine for the plan and the draft. `isLoading` covers the first read and every re-read. */
export function usePricePreview(plan: { key: string; sku: string | null } | null, extras: DraftExtra[], version: string | null) {
  const extraKey = extras.map((extra) => `${extra.offerKey}:${extra.sku}`).join(',');
  const { data, error, isValidating } = useSWR<PreviewResult>(
    plan && version !== null ? ['finder-preview', plan.key, plan.sku, extraKey, version] : null,
    () =>
      sendJson<PreviewResult>('/api/pricing/preview', 'POST', {
        planKey: plan?.key,
        ...(plan?.sku ? { sku: plan.sku } : {}),
        extras: extras.map((extra) => ({ offerKey: extra.offerKey, sku: extra.sku })),
      }),
    { keepPreviousData: false, shouldRetryOnError: false, dedupingInterval: 0 },
  );
  return { preview: data, error, loading: isValidating && !data };
}
