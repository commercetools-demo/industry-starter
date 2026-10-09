'use client';
import { useCallback } from 'react';
import type { StoredMethodDescriptor } from '@/lib/checkout/payment-provider';
import { apiPaymentMethod, apiPaymentMethodDefault } from '@/lib/api-paths';
import { fetchJson } from '@/lib/http';

export interface RemovedAnswer {
  methods: StoredMethodDescriptor[];
  wasDefault: boolean;
  pausedRefills: number;
}

/** Thrown by `remove` when an active auto-refill is charged to the card and the buyer has not confirmed yet. */
export class RefillDepends extends Error {
  constructor(readonly count: number) {
    super('refill depends');
    this.name = 'RefillDepends';
  }
}

/** The two writes of the payment methods page. After either the caller refreshes the route (the page is server-rendered). */
export function useMethodActions() {
  const makeDefault = useCallback((id: string) => fetchJson<{ methods: StoredMethodDescriptor[] }>(apiPaymentMethodDefault(id), { method: 'POST' }), []);

  const remove = useCallback(async (id: string, confirm: boolean): Promise<RemovedAnswer> => {
    const response = await fetch(apiPaymentMethod(id, confirm), { method: 'DELETE' });
    if (response.ok) return (await response.json()) as RemovedAnswer;
    const answer = (await response.json().catch(() => ({}))) as { code?: string; count?: number };
    if (response.status === 409 && answer.code === 'REFILL_DEPENDS') throw new RefillDepends(answer.count ?? 1);
    throw new Error('FAILED');
  }, []);

  return { makeDefault, remove };
}
