/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { forwardSimulate, parseSimulate, simulated } from './simulate';

describe('simulate switch', () => {
  it('simulate is ignored in production', () => {
    expect(parseSimulate('orders-down', { NODE_ENV: 'production' })).toEqual([]);
    expect(forwardSimulate('orders-down', { NODE_ENV: 'production' })).toBeUndefined();
  });

  it('parses known effects outside production and drops anything else', () => {
    const list = parseSimulate('orders-down, stock-empty,evil;drop,returns-slow', { NODE_ENV: 'development' });
    expect(list).toEqual(['orders-down', 'stock-empty', 'returns-slow']);
    expect(simulated(list, 'orders', 'down')).toBe(true);
    expect(simulated(list, 'returns', 'down')).toBe(false);
    expect(forwardSimulate(['orders-down'], { NODE_ENV: 'test' })).toBe('orders-down');
    expect(forwardSimulate(undefined, { NODE_ENV: 'test' })).toBeUndefined();
  });
});
