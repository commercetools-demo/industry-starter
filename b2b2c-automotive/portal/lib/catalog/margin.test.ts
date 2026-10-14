/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import * as margin from './margin';

describe('list distance', () => {
  it('below list percent and above list percent are neutral text; there is no margin or cost export', () => {
    expect(margin.belowListPercent(8800, 10000)).toBe(12);
    expect(margin.belowListPercent(1, 1000)).toBe(99.9);
    expect(margin.aboveListPercent(10800, 10000)).toBe(8);
    expect(margin.belowListPercent(11000, 10000)).toBe(0);
    expect(margin.listDistance(9000, 10000)).toEqual({ direction: 'below', percent: 10 });
    expect(margin.listDistance(10000, 10000)).toEqual({ direction: 'equal', percent: 0 });
    expect(margin.LIST_DISTANCE_TONE).toBe('neutral');
    for (const name of Object.keys(margin)) expect(name).not.toMatch(/margin|cost|thin/i);
  });
});
