import * as fx from '@/lib/offers/__fixtures__/offers';
import type { BuyerContext, CartLineRef, Offer } from '@/lib/types';
import { createCachedServiceability, createStubProvider } from './serviceability';
import { revalidateCart } from './revalidate';

const byKey = fx.offersByKey();
const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  channel: 'online',
  now: new Date('2026-10-07T12:00:00Z'),
  held: [],
  signedIn: false,
  ...patch,
});
const line = (lineItemId: string, offer: Offer, parentLineItemId?: string): CartLineRef => ({
  lineItemId,
  offerKey: offer.key,
  quantity: 1,
  ...(parentLineItemId ? { parentLineItemId } : {}),
});
const revalidate = (lines: CartLineRef[], context: BuyerContext = buyer(), offersByKey: Record<string, Offer> = byKey) => revalidateCart({ lines, offersByKey, buyer: context });

describe('revalidateCart', () => {
  it('a clean cart gives []', () => {
    expect(revalidate([line('NET', fx.cable500), line('ROUTER', fx.routerAx3000, 'NET'), line('PH', fx.phoneUnlimited)])).toEqual([]);
  });

  it('Eligibility lost before checkout: the line is kept and flagged blocking with the reason and no line is dropped', () => {
    const existingOnly: Offer = { ...fx.cableExisting, existingCustomer: 'existing' };
    const cart = [line('NET', existingOnly), line('PH', fx.phoneUnlimited)];
    const issues = revalidate(cart, buyer({ isExistingCustomer: false }), { ...byKey, [existingOnly.key]: existingOnly });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ lineItemId: 'NET', blocking: true, resolution: 'remove' });
    expect(issues[0].reasons[0]).toMatchObject({ code: 'NOT_ELIGIBLE_EXISTING_CUSTOMER', params: { offerName: 'Cable 500 for existing customers', rule: 'existing' } });
    expect(cart).toHaveLength(2);
    expect(revalidate(cart, buyer({ isExistingCustomer: true }), { ...byKey, [existingOnly.key]: existingOnly })).toEqual([]);
  });

  it('merges reasons of one line into one issue: eligibility, held service and a missing required equipment', async () => {
    const location = await createCachedServiceability(createStubProvider('table'), 300).check('60601', 'US');
    const held = [{ offerKey: fx.cable500.key, offerName: 'Cable 500', source: 'order' as const, reference: 'MLV-1' }];
    const issues = revalidate([line('NET', fx.wireless5g)], buyer({ location, held }));
    expect(issues).toHaveLength(1);
    expect(issues[0].resolution).toBe('remove');
    expect(issues[0].reasons.map((reason) => reason.code).sort()).toEqual(['HELD_SERVICE_CONFLICT', 'NOT_SERVICEABLE']);
  });

  it('resolution precedence: remove beats replace beats choose-equipment', () => {
    // replace: two conflicting plans, the later flagged
    expect(revalidate([line('A', fx.cable500), line('B', fx.wireless5g)]).map((issue) => [issue.lineItemId, issue.resolution])).toEqual([['B', 'replace']]);
    // choose-equipment: the plan requires a kind the catalog cannot supply
    const needsRouter: Offer = { ...fx.phoneEssential, key: 'malva-offer-needs-router', facts: { ...(fx.phoneEssential.facts as object), requiredEquipmentKinds: ['router'] } as Offer['facts'] };
    const noEquipment = Object.fromEntries(Object.entries(byKey).filter(([, offer]) => offer.kind !== 'equipment'));
    const choose = revalidate([line('N', needsRouter)], buyer(), { ...noEquipment, [needsRouter.key]: needsRouter });
    expect(choose.map((issue) => issue.resolution)).toEqual(['choose-equipment']);
    // replace + remove on the same line: ineligible AND conflicting is remove
    const retail: Offer = { ...fx.wireless5g, channels: ['retail'] };
    const both = revalidate([line('A', fx.cable500), line('B', retail)], buyer(), { ...byKey, [retail.key]: retail });
    expect(both).toHaveLength(1);
    expect(both[0]).toMatchObject({ lineItemId: 'B', resolution: 'remove' });
    expect(both[0].reasons.map((reason) => reason.code)).toEqual(['EXCLUSIVE_CONFLICT', 'NOT_ELIGIBLE_CHANNEL']);
  });

  it('keeps cart order and repeats no reason that two checks both produce (missing offer)', () => {
    const cart = [line('Z', fx.phonePlus), { lineItemId: 'A', offerKey: 'malva-offer-gone', quantity: 1 }, { lineItemId: 'M', offerKey: 'malva-offer-gone-too', quantity: 1 }];
    const issues = revalidate(cart);
    expect(issues.map((issue) => issue.lineItemId)).toEqual(['A', 'M']);
    expect(issues[0].reasons.map((reason) => reason.code)).toEqual(['OFFER_NOT_FOUND']);
  });
});
