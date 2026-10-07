import type { BuyerContext, CartIssue, CartIssueResolution, CartLineRef, Offer } from '@/lib/types';
import { revalidateCartCompat } from './compat';
import { revalidateCartEligibility } from './eligibility';
import { revalidateExclusivity } from './exclusivity';

const PRECEDENCE: Record<CartIssueResolution, number> = { remove: 3, replace: 2, 'choose-equipment': 1 };

/**
 * Everything wrong with a cart, one issue per line item in cart order: J's compatibility issues, K's exclusivity (cart pairs and
 * held services) and K's eligibility (audience, existing customer, channel, schedule, location). Reasons are concatenated
 * (a reason repeated by two checks is kept once); the resolution is the strongest: remove, then replace, then choose-equipment.
 * M calls it on every cart read; U refuses to start checkout while it returns anything. Lines are never dropped or repriced here.
 */
export function revalidateCart(args: { lines: CartLineRef[]; offersByKey: Record<string, Offer>; buyer: BuyerContext }): CartIssue[] {
  const { lines, offersByKey, buyer } = args;
  const all = [...revalidateCartCompat(lines, offersByKey), ...revalidateExclusivity(lines, buyer.held, offersByKey), ...revalidateCartEligibility(lines, offersByKey, buyer)];
  const merged = new Map<string, CartIssue>();
  for (const issue of all) {
    const existing = merged.get(issue.lineItemId);
    if (!existing) {
      merged.set(issue.lineItemId, { ...issue, reasons: [...issue.reasons] });
      continue;
    }
    const seen = new Set(existing.reasons.map((reason) => `${reason.code}|${reason.offerKeys.join(',')}`));
    for (const reason of issue.reasons) {
      const id = `${reason.code}|${reason.offerKeys.join(',')}`;
      if (!seen.has(id)) {
        seen.add(id);
        existing.reasons.push(reason);
      }
    }
    if (PRECEDENCE[issue.resolution] > PRECEDENCE[existing.resolution]) existing.resolution = issue.resolution;
  }
  const order = new Map(lines.map((line, index) => [line.lineItemId, index]));
  return [...merged.values()].sort((a, b) => (order.get(a.lineItemId) ?? 0) - (order.get(b.lineItemId) ?? 0));
}
