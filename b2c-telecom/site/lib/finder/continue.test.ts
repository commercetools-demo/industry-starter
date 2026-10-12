import { CartError } from '@/hooks/useCart';
import type { BlockedAdd, Cart, CartLine } from '@/lib/types';
import { continueWithPlan, type ContinueDeps } from './continue';
import type { DraftExtra } from './draft';

const plan = { offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M', name: 'Cable 500' };
const extra = (offerKey: string): DraftExtra => ({ offerKey, sku: `MLV-${offerKey}`, name: offerKey, kind: 'addon', equipmentKind: null });
const line = (id: string, offerKey: string, kind: CartLine['kind'], parentLineId?: string): CartLine => ({ id, offerKey, kind, parentLineId }) as CartLine;
const cartOf = (...lines: CartLine[]): Cart => ({ lines }) as Cart;
const refusal = (blocked: Partial<BlockedAdd>): CartError => new CartError('OFFER_BLOCKED', 'CONFLICT', 'blocked', { kind: 'incompatible', offerKey: 'x', reasons: [], ...blocked }, 409);

function world(initial: Cart | null, refuse: Record<string, CartError> = {}) {
  let cart = initial;
  const calls: string[] = [];
  const deps: ContinueDeps = {
    get cart() {
      return cart;
    },
    addLine: async (args) => {
      calls.push(args.offerKey + (args.replaceLineId ? '!' : ''));
      const error = refuse[args.offerKey];
      if (error) throw error;
      cart = cartOf(...(cart?.lines ?? []), line(`l-${args.offerKey}`, args.offerKey, args.parentLineId ? 'addon' : 'plan', args.parentLineId));
      return cart;
    },
  };
  return { deps, calls, cart: () => cart };
}

describe('continueWithPlan', () => {
  it('adds the plan, then each extra to the plan line', async () => {
    const w = world(null);
    const result = await continueWithPlan(w.deps, plan, [extra('a'), extra('b')]);
    expect(result).toEqual({ status: 'done', refused: [], notices: [] });
    expect(w.calls).toEqual([plan.offerKey, 'a', 'b']);
  });

  it('twice with the same plan and draft changes nothing the second time', async () => {
    const w = world(null);
    await continueWithPlan(w.deps, plan, [extra('a')]);
    const before = w.calls.length;
    await continueWithPlan(w.deps, plan, [extra('a')]);
    expect(w.calls).toHaveLength(before);
  });

  it('keeps the accepted lines and names the refused one with its reasons', async () => {
    const reasons = [{ code: 'INCOMPATIBLE', messageKey: 'k', params: {}, offerKeys: [] }] as unknown as BlockedAdd['reasons'];
    const w = world(null, { a: refusal({ reasons }) });
    const result = await continueWithPlan(w.deps, plan, [extra('a'), extra('b')]);
    expect(result).toEqual({ status: 'done', refused: [{ offerKey: 'a', name: 'a', reasons }], notices: [] });
    expect(w.calls).toEqual([plan.offerKey, 'a', 'b']);
  });

  it('a same-technology plan in the cart offers replace-or-keep and changes nothing', async () => {
    const replace = { removeLineId: 'old', removeOfferKey: 'malva-offer-cable-100', removeOfferName: 'Cable 100' };
    const w = world(cartOf(line('old', 'malva-offer-cable-100', 'plan')), { [plan.offerKey]: refusal({ kind: 'conflict', replace }) });
    const result = await continueWithPlan(w.deps, plan, [extra('a')]);
    expect(result.status).toBe('choose');
    expect(w.calls).toEqual([plan.offerKey]);
  });

  it('replace sends replaceLineId and goes on with the extras', async () => {
    const w = world(cartOf(line('old', 'malva-offer-cable-100', 'plan')));
    const result = await continueWithPlan(w.deps, plan, [extra('a')], 'old');
    expect(result.status).toBe('done');
    expect(w.calls).toEqual([`${plan.offerKey}!`, 'a']);
  });

  it('a refused plan with another reason is a failure', async () => {
    const w = world(null, { [plan.offerKey]: refusal({ kind: 'ineligible' }) });
    expect((await continueWithPlan(w.deps, plan, [])).status).toBe('failed');
  });
});
