/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { auditPrices, EXPECTED_PROJECT_KEY, run } from './audit-prices.mjs';

const stores = [
  { key: 'mau-reseller-north', countries: [{ code: 'DE' }], distributionChannels: [{ id: 'ch-north' }, { id: 'ch-north-b1' }] },
  { key: 'mau-reseller-south', countries: [{ code: 'DE' }, { code: 'US' }], distributionChannels: [{ id: 'ch-south' }] },
];
const money = (centAmount, currencyCode = 'EUR') => ({ type: 'centPrecision', currencyCode, centAmount, fractionDigits: 2 });
const price = (id, value, channel) => ({ id, sku: `SKU-${id}`, value, ...(channel ? { channel: { id: channel } } : {}) });

describe('audit prices', () => {
  it('a clean project exits 0 (no problems)', () => {
    expect(auditPrices({ stores, prices: [price('1', money(1000)), price('2', money(1), 'ch-north'), price('3', money(5000, 'USD'), 'ch-south'), price('4', money(900), 'ch-north-b1')] })).toEqual([]);
  });
  it('a zero, negative, fractional or high precision price is INVALID_MONEY', () => {
    const bad = [money(0), money(-1), money(10.5), { type: 'highPrecision', currencyCode: 'EUR', centAmount: 100, preciseAmount: 1005, fractionDigits: 3 }, { ...money(100), fractionDigits: 3 }];
    const problems = auditPrices({ stores, prices: bad.map((v, i) => price(String(i), v, 'ch-north')) });
    expect(problems.map((p) => p.code)).toEqual(bad.map(() => 'INVALID_MONEY'));
  });
  it('a price on a channel that belongs to no store is flagged, also a branch of a store that was removed', () => {
    expect(auditPrices({ stores, prices: [price('1', money(100), 'ch-foreign')] }).map((p) => p.code)).toEqual(['CHANNEL_WITHOUT_STORE']);
  });
  it('USD on a store that does not sell in the US is flagged; USD on the US store is fine', () => {
    expect(auditPrices({ stores, prices: [price('1', money(100, 'USD'), 'ch-north')] }).map((p) => p.code)).toEqual(['CURRENCY_NOT_SOLD']);
    expect(auditPrices({ stores, prices: [price('1', money(100, 'USD'), 'ch-south')] })).toEqual([]);
  });
  it('refuses any project other than the spec-test project, before any request', async () => {
    expect(EXPECTED_PROJECT_KEY).toBe('spec-test-b2b2c-automotive');
    expect(await run({ CTP_PROJECT_KEY: 'health-project' })).toBe(2);
    expect(await run({ CTP_PROJECT_KEY: EXPECTED_PROJECT_KEY })).toBe(2); // credentials missing
  });
});
