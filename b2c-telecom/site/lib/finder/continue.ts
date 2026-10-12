import { CartError, type AddLineArgs, type AddLineOptions } from '@/hooks/useCart';
import type { BlockedAdd, BundleIssueReason, Cart, CartNotice } from '@/lib/types';
import type { DraftExtra } from './draft';

// The finder's one-button Continue: the plan, then each extra attached to the plan line, through the ordinary cart add (so the server
// guard decides every line). Idempotent: a plan or extra already in the cart is not added again, so pressing Continue twice changes nothing.

export interface ContinuePlan {
  offerKey: string;
  sku: string;
  name: string;
}

export interface Refusal {
  offerKey: string;
  name: string;
  reasons: BundleIssueReason[];
}

export type ContinueResult =
  /** The plan is in the cart; `refused` lines were not added. */
  | { status: 'done'; refused: Refusal[]; notices: CartNotice[] }
  /** The cart holds another plan of the same technology: the buyer chooses replace or keep (nothing was changed). */
  | { status: 'choose'; blocked: BlockedAdd }
  /** The plan itself was refused or the service failed: nothing to show on /bundle. */
  | { status: 'failed'; blocked?: BlockedAdd };

export interface ContinueDeps {
  cart: Cart | null;
  addLine: (args: AddLineArgs, options?: AddLineOptions) => Promise<Cart | null>;
}

const planLineOf = (cart: Cart | null, offerKey: string) => cart?.lines.find((line) => line.kind === 'plan' && line.offerKey === offerKey);

export async function continueWithPlan(deps: ContinueDeps, plan: ContinuePlan, extras: DraftExtra[], replaceLineId?: string): Promise<ContinueResult> {
  const notices: CartNotice[] = [];
  const onNotices = (more: CartNotice[]): void => void notices.push(...more);
  let cart = deps.cart;

  if (!planLineOf(cart, plan.offerKey)) {
    try {
      cart = await deps.addLine({ offerKey: plan.offerKey, sku: plan.sku, quantity: 1, ...(replaceLineId ? { replaceLineId } : {}) });
    } catch (error) {
      const blocked = error instanceof CartError ? error.blocked : undefined;
      if (blocked?.kind === 'conflict' && blocked.replace && !replaceLineId) return { status: 'choose', blocked };
      return { status: 'failed', ...(blocked ? { blocked } : {}) };
    }
  }
  const planLine = planLineOf(cart, plan.offerKey);
  if (!planLine) return { status: 'failed' };

  const refused: Refusal[] = [];
  for (const extra of extras) {
    const attached = cart?.lines.some((line) => line.offerKey === extra.offerKey && line.parentLineId === planLine.id && line.kind !== 'fee');
    if (attached) continue;
    try {
      cart = (await deps.addLine({ offerKey: extra.offerKey, sku: extra.sku, quantity: 1, parentLineId: planLine.id }, { onNotices })) ?? cart;
    } catch (error) {
      const blocked = error instanceof CartError ? error.blocked : undefined;
      refused.push({ offerKey: extra.offerKey, name: extra.name, reasons: blocked?.reasons ?? [] });
    }
  }
  return { status: 'done', refused, notices };
}
