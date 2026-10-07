// The financing decision (D-015): a Malva-side interface with a deterministic STUB. Nothing in `app/` may contain these rules; a real
// credit provider replaces `getFinancingProvider` in this one place. Pure: no I/O, no crypto, the clock is injected.
import { FINANCING_LIMIT_CENTS } from '@/lib/config/devices';
import type { FinancingDecision, FinancingReason, FinancingRequest, Money } from '@/lib/types';

export interface FinancingProvider {
  decide(request: FinancingRequest): Promise<FinancingDecision>;
}

/** FNV-1a, 32 bit: a stable hash of a string (no `crypto`, so the decision is a pure function of the request). */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** `stub-` + 8 hex digits of the hash of the customer, the currency and the sorted financed lines. */
export function decisionIdOf(request: FinancingRequest): string {
  const lines = request.lines.map((line) => `${line.lineId}:${line.mode}:${line.termMonths}:${line.quantity}:${line.monthly.centAmount}`).sort();
  return `stub-${fnv1a32(`${request.customerId ?? ''}|${request.currency}|${lines.join(',')}`).toString(16).padStart(8, '0')}`;
}

/** Sum of monthly x term x quantity over the financed lines, in minor units. */
export function financedTotalOf(request: FinancingRequest): Money {
  return { centAmount: request.lines.reduce((sum, line) => sum + line.monthly.centAmount * line.termMonths * line.quantity, 0), currencyCode: request.currency };
}

/**
 * The rules, in this order: (a) nothing is financed: approved; (b) a financed line and no customer: sign in first (guests may still buy
 * outright, D-035); (c) the customer's flag says decline: declined; (d) the financed total is above the limit: declined; else approved.
 */
export function createStubProvider(now: () => Date = () => new Date()): FinancingProvider {
  return {
    async decide(request) {
      const financedTotal = financedTotalOf(request);
      const limit: Money = { centAmount: FINANCING_LIMIT_CENTS[request.currency], currencyCode: request.currency };
      const verdict = (outcome: FinancingDecision['outcome'], reason: FinancingReason): FinancingDecision => ({
        decisionId: decisionIdOf(request),
        outcome,
        reason,
        financedTotal,
        limit,
        decidedAt: now().toISOString(),
      });
      if (request.lines.length === 0) return verdict('approved', 'no-financed-lines');
      if (request.customerId === null) return verdict('sign-in-required', 'sign-in-required');
      if (request.creditFlag === 'decline') return verdict('declined', 'customer-declined');
      if (financedTotal.centAmount > limit.centAmount) return verdict('declined', 'amount-over-limit');
      return verdict('approved', 'ok');
    },
  };
}

/** The provider in use: the stub. No environment variable in v1. */
export function getFinancingProvider(): FinancingProvider {
  return createStubProvider();
}
