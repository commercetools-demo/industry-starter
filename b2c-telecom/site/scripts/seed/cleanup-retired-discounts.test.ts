/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { computeRetired, keptDiscountKeys, main } from './cleanup-retired-discounts';
import { FakeCt } from './test/fake-ct';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const CONFIRM = ['--confirm-project', 'spec-test-b2c-telecom'];
let api: FakeCt;
let lines: string[];
const log = (line: string): void => void lines.push(line);

beforeEach(() => {
  lines = [];
  api = new FakeCt();
  for (const key of ['malva-cd-intro-free-month', 'malva-cd-welcome-10', 'malva-cd-code-cable5']) api.seed('cart-discounts', { key });
  for (const key of ['malva-cd-second-line-10', 'malva-cd-bundle-5', 'malva-cd-tier-year1-20', 'malva-cd-intro-cable-100-24']) api.seed('cart-discounts', { key });
  api.seed('cart-discounts', { key: 'FurnitureBOGO' }); // not ours
  api.seed('cart-discounts', { key: 'mc-summer-sale' }); // a Merchant Center discount
});

describe('seed:cleanup-discounts', () => {
  it('keeps the manifest discounts and the ones the storefront names', () => {
    expect([...keptDiscountKeys()].sort()).toEqual(['malva-cd-code-cable5', 'malva-cd-intro-free-month', 'malva-cd-welcome-10']);
  });

  it('lists only owned discounts that are no longer wanted', async () => {
    expect((await computeRetired(api)).discounts.map((d) => d.key).sort()).toEqual(['malva-cd-bundle-5', 'malva-cd-intro-cable-100-24', 'malva-cd-second-line-10', 'malva-cd-tier-year1-20']);
  });

  it('is read-only by default: lists, removes nothing and needs no project confirmation', async () => {
    expect(await main([], { api, source: SOURCE, log })).toBe(0);
    expect(lines.filter((line) => line.startsWith('would remove'))).toHaveLength(4);
    expect(api.list('cart-discounts')).toHaveLength(9);
  });

  it('--execute needs the project confirmation; with it removes exactly the listed discounts and nothing else', async () => {
    expect(await main(['--execute'], { api, source: SOURCE, log })).not.toBe(0);
    expect(api.list('cart-discounts')).toHaveLength(9);
    expect(await main(['--execute', ...CONFIRM], { api, source: SOURCE, log })).toBe(0);
    expect(api.keysOf('cart-discounts').sort()).toEqual(['FurnitureBOGO', 'malva-cd-code-cable5', 'malva-cd-intro-free-month', 'malva-cd-welcome-10', 'mc-summer-sale']);
  });

  it('removes a discount code that points at a retired discount first, and a second run is a no-op', async () => {
    const retired = api.byKey('cart-discounts', 'malva-cd-bundle-5') as unknown as { id: string };
    api.seed('discount-codes', { key: 'malva-dc-old', code: 'OLD', cartDiscounts: [{ typeId: 'cart-discount', id: retired.id }] });
    expect(await main(['--execute', ...CONFIRM], { api, source: SOURCE, log })).toBe(0);
    expect(api.list('discount-codes')).toHaveLength(0);
    lines = [];
    expect(await main(['--execute', ...CONFIRM], { api, source: SOURCE, log })).toBe(0);
    expect(lines).toEqual(['Nothing to remove: no retired cart discounts in the project.']);
  });
});
