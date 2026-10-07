// @vitest-environment node
import { cartOffersByKey } from '@/lib/cart/__fixtures__/offers';
import { PROMPT_PAIRINGS } from '@/lib/config/promptPairings';
import { addLineItemAction, buildProbeDraft } from '@/lib/ct/cartDrafts';
import type { BuyerContext, Offer } from '@/lib/types';
import { ctCart, type LineSpec } from '@/test/fixtures/ctCart';

const probe = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('./client', () => ({ getApiRoot: () => ({}) }));
vi.mock('./cart', async (original) => ({
  ...(await original<typeof import('./cart')>()),
  createProbeCart: (draft: unknown) => probe.create(draft),
  deleteCart: (cart: unknown) => probe.remove(cart),
}));

import { attributable, getPrompts, promptState } from './prompts';

const market = { locale: 'en-US', currency: 'USD', country: 'US' } as const;
const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({ customerType: 'consumer', isExistingCustomer: false, channel: 'online', now: new Date('2026-10-07T12:00:00Z'), held: [], signedIn: false, ...patch });
const discountKeyById = { 'cd-bundle': 'malva-cd-bundle-5', 'cd-second': 'malva-cd-second-line-10' };
const offers = cartOffersByKey();

const cable: LineSpec = { id: 'L1', sku: 'MLV-CBL-500-24M', offerKey: 'malva-offer-cable-500', price: 5999, mode: 'Fixed' };
const phone: LineSpec = { id: 'P1', sku: 'MLV-PHN-ESS-M2M', offerKey: 'malva-offer-phone-essential', price: 2500, mode: 'Dynamic' };

const input = (lines: LineSpec[], patch: { offersByKey?: Record<string, Offer>; buyer?: BuyerContext } = {}) => ({
  ct: ctCart({ lines }),
  market,
  offersByKey: patch.offersByKey ?? offers,
  buyer: patch.buyer ?? buyer(),
  discountKeyById,
});

const original = [...PROMPT_PAIRINGS];
beforeEach(() => {
  probe.create.mockReset();
  probe.remove.mockReset();
  probe.remove.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  PROMPT_PAIRINGS.splice(0, PROMPT_PAIRINGS.length, ...original);
});

/** What the engine would answer for cable + essential: the bundle discount takes $5 off the cable line. */
const pricedBundle = () => ctCart({ lines: [{ ...cable, discounts: ['cd-bundle'], discountCents: 500, total: 5499 }, phone] });

describe('attributable', () => {
  it('sums discountedAmount x quantity of the matching discount over monthly lines only', () => {
    const cart = ctCart({ lines: [{ ...cable, quantity: 2, discounts: ['cd-bundle'], discountCents: 500 }, { id: 'X', sku: 'MLV-EQP-AX3000-BUY', offerKey: 'malva-offer-router-ax3000', price: 100, discounts: ['cd-bundle'], discountCents: 99 }] });
    expect(attributable(cart, 'malva-cd-bundle-5', discountKeyById)).toBe(1000);
    expect(attributable(cart, 'malva-cd-second-line-10', discountKeyById)).toBe(0);
  });
});

describe('promptState', () => {
  it('reads categories, phone lines, the single phone offer and its term', () => {
    const withCategories = { ...offers, 'malva-offer-cable-500': { ...offers['malva-offer-cable-500'], categoryKeys: ['malva-cat-cable-internet'] } };
    const state = promptState(ctCart({ lines: [cable, { ...phone, quantity: 1 }] }), withCategories);
    expect(state.hasCategory('malva-cat-cable-internet')).toBe(true);
    expect(state.hasCategory('malva-cat-phone-plans')).toBe(false);
    expect(state.phoneLineCount()).toBe(1);
    expect(state.phoneOfferKey()).toBe('malva-offer-phone-essential');
    expect(state.phoneTerm()).toBe(0);
    expect(state.phoneSku()).toBe('MLV-PHN-ESS-M2M');
  });
});

describe('getPrompts', () => {
  const withCategories: Record<string, Offer> = {
    ...offers,
    'malva-offer-cable-500': { ...offers['malva-offer-cable-500'], categoryKeys: ['malva-cat-cable-internet'] },
    'malva-offer-phone-essential': { ...offers['malva-offer-phone-essential'], categoryKeys: ['malva-cat-phone-plans'] },
    'malva-offer-phone-unlimited': { ...offers['malva-offer-phone-unlimited'], categoryKeys: ['malva-cat-phone-plans'] },
  };

  it('Reachable discount surfaced: cable plan without phone yields the bundle prompt', async () => {
    probe.create.mockResolvedValue(pricedBundle());
    const prompts = await getPrompts(input([cable], { offersByKey: withCategories }));
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      pairingKey: 'bundle-cable-phone',
      discountKey: 'malva-cd-bundle-5',
      messageKey: 'bundle.prompt.cablePhone',
      candidate: { offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M', name: 'Essential', quantity: 1, termMonths: 0 },
    });
  });

  it('Saving is quantified: prompt carries an amount from the priced prospective cart', async () => {
    probe.create.mockResolvedValue(pricedBundle());
    const [prompt] = await getPrompts(input([cable], { offersByKey: withCategories }));
    expect(prompt?.saving).toEqual({ centAmount: 500, currencyCode: 'USD' });
    expect(prompt?.params).toEqual({ name: 'Essential', saving: '$5.00' });
  });

  it('Satisfied discount not repeated: no prompt when the discount already applies', async () => {
    const satisfied = [{ ...cable, discounts: ['cd-bundle'], discountCents: 500 }, { ...phone, quantity: 2 }];
    const prompts = await getPrompts(input(satisfied, { offersByKey: withCategories }));
    expect(prompts).toEqual([]);
    expect(probe.create).not.toHaveBeenCalled();
  });

  it('No reachable discount: nothing is suggested', async () => {
    expect(await getPrompts(input([], { offersByKey: withCategories }))).toEqual([]);
    expect(await getPrompts(input([{ ...phone, quantity: 2 }], { offersByKey: withCategories }))).toEqual([]);
    expect(probe.create).not.toHaveBeenCalled();
  });

  it('second line: one phone line suggests another line of the same plan with the quoted saving', async () => {
    probe.create.mockResolvedValue(ctCart({ lines: [{ ...phone, quantity: 2, discounts: ['cd-second'], discountCents: 1000, discountedUnits: 1 }] }));
    const prompts = await getPrompts(input([phone], { offersByKey: withCategories }));
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ pairingKey: 'second-line', saving: { centAmount: 1000 }, candidate: { offerKey: 'malva-offer-phone-essential', sku: 'MLV-PHN-ESS-M2M', quantity: 1 } });
    expect(prompts[0]?.params.saving).toBe('$10.00');
  });

  it('Ineligible offer never suggested: a pairing for another customer group or a blocked candidate is skipped before pricing', async () => {
    PROMPT_PAIRINGS[0] = { ...(PROMPT_PAIRINGS[0] as (typeof PROMPT_PAIRINGS)[number]), eligibleGroups: ['employee'] };
    expect(await getPrompts(input([cable], { offersByKey: withCategories }))).toEqual([]);
    PROMPT_PAIRINGS[0] = { ...(original[0] as (typeof PROMPT_PAIRINGS)[number]) };
    const blocked = { ...withCategories, 'malva-offer-phone-essential': { ...withCategories['malva-offer-phone-essential'], audience: ['employee' as const] } };
    expect(await getPrompts(input([cable], { offersByKey: blocked }))).toEqual([]);
    expect(probe.create).not.toHaveBeenCalled();
  });

  it('a pairing for the buyer group is priced', async () => {
    PROMPT_PAIRINGS[0] = { ...(PROMPT_PAIRINGS[0] as (typeof PROMPT_PAIRINGS)[number]), eligibleGroups: ['consumer'] };
    probe.create.mockResolvedValue(pricedBundle());
    expect(await getPrompts(input([cable], { offersByKey: withCategories }))).toHaveLength(1);
  });

  it('Suggestion is honoured when taken: the discount applied after the real add equals the stated saving (same line shape, same function)', async () => {
    probe.create.mockResolvedValue(pricedBundle());
    const before = input([cable], { offersByKey: withCategories });
    const [prompt] = await getPrompts(before);
    // the real add builds the same line the probe was priced with
    const offer = offers['malva-offer-phone-essential'] as Offer;
    const variant = offer.variants.find((entry) => entry.sku === prompt?.candidate.sku);
    const real = addLineItemAction({ offer, variant: variant!, quantity: 1 });
    const draft = buildProbeDraft(before.ct, market, { offer, variant: variant!, quantity: 1 }, 'prompt-probe-x');
    const { action, ...realLine } = real;
    void action;
    expect(draft.lineItems?.at(-1)).toEqual(realLine);
    // and the cart after the real add shows the stated saving
    const afterReal = pricedBundle();
    expect(attributable(afterReal, prompt!.discountKey, discountKeyById) - attributable(before.ct, prompt!.discountKey, discountKeyById)).toBe(prompt!.saving.centAmount);
  });

  it('a suppressed discount (the probe shows 0) is skipped and the probe is still deleted', async () => {
    probe.create.mockResolvedValue(ctCart({ lines: [cable, phone] }));
    expect(await getPrompts(input([cable], { offersByKey: withCategories }))).toEqual([]);
    expect(probe.remove).toHaveBeenCalledTimes(1);
  });

  it('the probe cart is deleted even when pricing fails afterwards, and a failed create does not fail the prompts', async () => {
    probe.create.mockResolvedValueOnce({ ...pricedBundle(), discountedPricePerQuantity: undefined, lineItems: null });
    expect(await getPrompts(input([cable], { offersByKey: withCategories }))).toEqual([]);
    expect(probe.remove).toHaveBeenCalledTimes(1);
    probe.create.mockRejectedValueOnce(new Error('boom'));
    expect(await getPrompts(input([cable], { offersByKey: withCategories }))).toEqual([]);
    expect(probe.remove).toHaveBeenCalledTimes(1);
  });

  it('the probe cart is a copy of the cart plus the candidate, marked as a probe that expires in a day', async () => {
    probe.create.mockResolvedValue(pricedBundle());
    await getPrompts(input([cable], { offersByKey: withCategories }));
    const draft = probe.create.mock.calls[0]?.[0];
    expect(draft).toMatchObject({ currency: 'USD', country: 'US', inventoryMode: 'None', taxMode: 'Platform', origin: 'Merchant', deleteDaysAfterLastModification: 1 });
    expect(draft.key).toMatch(/^prompt-probe-/);
    expect(draft.lineItems.map((line: { sku: string }) => line.sku)).toEqual(['MLV-CBL-500-24M', 'MLV-PHN-ESS-M2M']);
  });

  it('prices at most three candidates', async () => {
    probe.create.mockResolvedValue(pricedBundle());
    await getPrompts(input([cable], { offersByKey: withCategories }));
    expect(probe.create.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
