// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { customerBelongsToStore } from './customer-store';

describe('Stateless session: Customer bound to a store', () => {
  it('Customer bound to a store', () => {
    const stores = [{ key: 'mau-store-north' }];
    expect(customerBelongsToStore(stores, 'mau-store-south')).toBe(false);
    expect(customerBelongsToStore(stores, 'mau-store-north')).toBe(true);
  });
  it('Customer without stores is refused', () => {
    expect(customerBelongsToStore(undefined, 'mau-store-north')).toBe(false);
    expect(customerBelongsToStore([], 'mau-store-north')).toBe(false);
  });
  it('A key that only contains the store key is not a match', () => {
    expect(customerBelongsToStore([{ key: 'mau-store-north-2' }], 'mau-store-north')).toBe(false);
  });
});
