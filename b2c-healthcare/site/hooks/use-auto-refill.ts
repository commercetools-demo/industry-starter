'use client';
import { useCallback } from 'react';
import { API_AUTO_REFILL, apiAutoRefill } from '@/lib/api-paths';
import { fetchJson } from '@/lib/http';
import type { NotAddedReason } from '@/lib/order-types';
import type { Cadence, RefillAction, RefillView } from '@/lib/refill-types';

const json = { 'content-type': 'application/json' } as const;
const body = (value: unknown): RequestInit => ({ headers: json, body: JSON.stringify(value) });

export interface EnableResult {
  refill: RefillView;
  notIncluded: { name: string; reason: NotAddedReason }[];
}

/**
 * The auto-refill writes. The page is server-rendered per patient (no client cache to clear at sign-out), so after a
 * write the caller refreshes the route. Errors are `HttpError` with the server's readable sentence; for a blocked resume
 * the 409 body carries `code: 'RESUME_BLOCKED'` and a `reason`, read by `useRefillActions().act` through `ResumeBlocked`.
 */
export class ResumeBlocked extends Error {
  constructor(readonly reason: string) {
    super('resume blocked');
    this.name = 'ResumeBlocked';
  }
}

export function useRefillActions() {
  const enableRx = useCallback((rxNumber: string, lineRefs: string[], cadence: Cadence) => fetchJson<EnableResult>(API_AUTO_REFILL, { method: 'POST', ...body({ rxNumber, lineRefs, cadence }) }), []);
  const enableOrder = useCallback((orderId: string, cadence: Cadence) => fetchJson<EnableResult>(API_AUTO_REFILL, { method: 'POST', ...body({ orderId, cadence }) }), []);

  const act = useCallback(async (id: string, action: RefillAction): Promise<RefillView> => {
    const response = await fetch(apiAutoRefill(id), { method: 'POST', ...body({ action }) });
    if (response.ok) return (await response.json()) as RefillView;
    const answer = (await response.json().catch(() => ({}))) as { code?: string; reason?: string };
    if (response.status === 409 && answer.code === 'RESUME_BLOCKED' && answer.reason) throw new ResumeBlocked(answer.reason);
    throw new Error(answer.code === 'BUSY' ? 'BUSY' : 'FAILED');
  }, []);

  const changeCadence = useCallback((id: string, cadence: Cadence) => fetchJson<RefillView>(apiAutoRefill(id), { method: 'PATCH', ...body({ cadence }) }), []);

  return { enableRx, enableOrder, act, changeCadence };
}
