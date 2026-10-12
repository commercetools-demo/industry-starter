// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveOrderNumber, ORDER_NUMBER_FORMAT } from './order-number';

describe('deriveOrderNumber', () => {
  it('order number is deterministic for an id', () => {
    expect(deriveOrderNumber('3f1c0c52-1111-4222-8333-944455556666')).toBe(deriveOrderNumber('3f1c0c52-1111-4222-8333-944455556666'));
  });
  it('format is MA- plus 8 Crockford characters', () => {
    for (const id of ['a', 'b', 'cart-1', 'order-2', crypto.randomUUID()]) expect(deriveOrderNumber(id)).toMatch(ORDER_NUMBER_FORMAT);
  });
  it('salt changes the number', () => {
    expect(deriveOrderNumber('cart-1', 1)).not.toBe(deriveOrderNumber('cart-1', 0));
    expect(deriveOrderNumber('cart-1', 1)).not.toBe(deriveOrderNumber('cart-1', 2));
  });
  it('different ids give different numbers', () => {
    const numbers = new Set(Array.from({ length: 500 }, (_, i) => deriveOrderNumber(`cart-${i}`)));
    expect(numbers.size).toBe(500);
  });
});
