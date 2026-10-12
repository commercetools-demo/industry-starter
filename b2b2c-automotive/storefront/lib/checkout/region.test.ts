// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkoutRegionFromEnv, deriveRegion } from './region';

describe('checkoutRegionFromEnv', () => {
  const url = 'https://api.europe-west1.gcp.commercetools.com';
  it('is the region only with an application key', () => {
    expect(checkoutRegionFromEnv({ CTP_API_URL: url, CTP_CHECKOUT_APP_KEY: 'app' })).toBe('europe-west1.gcp');
    expect(checkoutRegionFromEnv({ CTP_API_URL: url })).toBeUndefined();
    expect(checkoutRegionFromEnv({ CTP_API_URL: url, CTP_CHECKOUT_APP_KEY: '  ' })).toBeUndefined();
  });
  it('never throws for an unusable url', () => {
    expect(checkoutRegionFromEnv({ CTP_API_URL: 'https://api.example.test', CTP_CHECKOUT_APP_KEY: 'app' })).toBeUndefined();
  });
});

describe('deriveRegion', () => {
  it('region from eu and us urls', () => {
    expect(deriveRegion('https://api.us-central1.gcp.commercetools.com')).toBe('us-central1.gcp');
    expect(deriveRegion('https://api.eu-central-1.aws.commercetools.com/')).toBe('eu-central-1.aws');
    expect(deriveRegion('https://api.europe-west1.gcp.commercetools.com')).toBe('europe-west1.gcp');
  });
  it('bad url throws', () => {
    expect(() => deriveRegion('not a url')).toThrow(/valid URL/);
    expect(() => deriveRegion('https://example.com')).toThrow(/commercetools API host/);
  });
});
