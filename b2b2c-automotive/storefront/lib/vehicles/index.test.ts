// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { getProvider, isLookupEnabled } from './index';

describe('Provider selection and lookup switch', () => {
  it('defaults to the stub', () => {
    expect(getProvider({}).id).toBe('stub');
    expect(getProvider({ VEHICLE_PROVIDER: 'stub' }).id).toBe('stub');
  });

  it('unknown provider id throws', () => {
    expect(() => getProvider({ VEHICLE_PROVIDER: 'acme' })).toThrow('VEHICLE_PROVIDER');
  });

  it('lookup is on outside production and off in production unless set', () => {
    expect(isLookupEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isLookupEnabled({ NODE_ENV: 'test' })).toBe(true);
    expect(isLookupEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(isLookupEnabled({ NODE_ENV: 'production', VEHICLE_LOOKUP_ENABLED: 'true' })).toBe(true);
    expect(isLookupEnabled({ NODE_ENV: 'development', VEHICLE_LOOKUP_ENABLED: 'false' })).toBe(false);
  });
});
