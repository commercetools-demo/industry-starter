/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { CABLE5_CODE, DISCOUNT_AMOUNTS, DISCOUNT_KEYS } from '../../lib/config/discounts';
import { cable5Code, cable5Discount } from './data/cart-discounts/code-cable5';
import { EXIT } from './config';
import { applyDiscountCodes, applyDiscounts, main } from './discounts';
import { FakeCt } from './test/fake-ct';
import { planCartDiscount } from './reconcilers/cartDiscount';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };

describe('seed:discounts', () => {
  it('refuses a project key other than spec-test-b2c-telecom', async () => {
    const api = new FakeCt();
    const log: string[] = [];
    const code = await main(['--confirm-project', 'other-project'], { api, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'other-project' }, log: (l) => log.push(l) });
    expect(code).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });

  it('refuses to write without the confirm flag', async () => {
    const api = new FakeCt();
    expect(await main([], { api, source: SOURCE, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });

  it('refuses a manifest key not starting malva-cd-', async () => {
    const api = new FakeCt();
    await expect(applyDiscounts(api, [{ ...cable5Discount, key: 'FurnitureBOGO' }])).rejects.toThrow(/malva-cd-/);
    expect(api.writes).toBe(0);
  });

  it('creates the code discount when missing, and running twice sends nothing', async () => {
    const api = new FakeCt();
    const log: string[] = [];
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom'], { api, source: SOURCE, log: (l) => log.push(l) })).toBe(EXIT.OK);
    expect(api.keysOf('cart-discounts')).toEqual(['malva-cd-code-cable5']);
    expect(api.keysOf('discount-codes')).toEqual(['malva-dc-cable5']);
    const writes = api.writes;
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom'], { api, source: SOURCE, log: (l) => log.push(l) })).toBe(EXIT.OK);
    expect(api.writes).toBe(writes);
  });

  it('Campaign withdrawn after purchase: deactivating changes only isActive', () => {
    const existing = { id: 'x', version: 1, ...cable5Discount };
    const plan = planCartDiscount(existing, { ...cable5Discount, isActive: false });
    expect(plan.actions).toEqual([{ action: 'changeIsActive', isActive: false }]);
    expect(plan.changes.map((c) => c.path)).toEqual(['isActive']);
  });
});

describe('MALVA-CABLE5 (workstream M)', () => {
  it('the discount targets cable line items, needs the code and uses the shared amounts for USD and EUR', () => {
    expect(cable5Discount.key).toBe(DISCOUNT_KEYS.codeCable5);
    expect(cable5Discount.key.startsWith('malva-cd-')).toBe(true);
    expect(cable5Discount.requiresDiscountCode).toBe(true);
    expect(cable5Discount.target).toMatchObject({ type: 'lineItems', predicate: 'attributes.`offer-family` = "cable"' });
    expect(cable5Discount.cartPredicate).toContain('lineItemExists');
    expect(cable5Discount.value).toEqual({
      type: 'absolute',
      money: [
        { currencyCode: 'USD', centAmount: DISCOUNT_AMOUNTS.codeCable5.USD },
        { currencyCode: 'EUR', centAmount: DISCOUNT_AMOUNTS.codeCable5.EUR },
      ],
    });
  });

  it('the welcome discount reads the shared amount', async () => {
    const { cartDiscounts } = await import('./data/cart-discounts');
    const money = (cartDiscounts.find((d) => d.key === DISCOUNT_KEYS.welcome10)?.value as { money: { centAmount: number }[] }).money.map((m) => m.centAmount);
    expect(money).toEqual([DISCOUNT_AMOUNTS.welcome10.USD, DISCOUNT_AMOUNTS.welcome10.EUR]);
  });

  it('the code is created once, updated when it differs and never sent when equal', async () => {
    const api = new FakeCt();
    await applyDiscounts(api, [cable5Discount]);
    expect((await applyDiscountCodes(api, [cable5Code])).map((o) => o.result)).toEqual(['created']);
    const writes = api.writes;
    expect((await applyDiscountCodes(api, [cable5Code])).map((o) => o.result)).toEqual(['unchanged']);
    expect(api.writes).toBe(writes);
    expect((await applyDiscountCodes(api, [{ ...cable5Code, isActive: false }])).map((o) => o.result)).toEqual(['updated']);
    expect(cable5Code.code).toBe(CABLE5_CODE.code);
  });
});
