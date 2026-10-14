// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { subscriptionsPurchaseEnabled, SUBSCRIPTION_PRICE_MODE } from './config';

describe('subscription purchase config', () => {
  it('is on unless the flag is false', () => {
    expect(subscriptionsPurchaseEnabled({})).toBe(true);
    expect(subscriptionsPurchaseEnabled({ SUBSCRIPTIONS_PURCHASE_ENABLED: 'true' })).toBe(true);
    expect(subscriptionsPurchaseEnabled({ SUBSCRIPTIONS_PURCHASE_ENABLED: ' False ' })).toBe(false);
  });
  it('renewals use the current price', () => {
    expect(SUBSCRIPTION_PRICE_MODE).toBe('Dynamic');
  });
});
