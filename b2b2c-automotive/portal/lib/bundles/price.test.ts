/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { bundlePrice } from './price';

describe('bundle price example', () => {
  it('16840 cents and 10 percent give 15156 and a saving of 1684', () => {
    const result = bundlePrice([{ retailCents: 9000, qty: 1 }, { retailCents: 3920, qty: 2 }], 10);
    expect(result).toEqual({ totalCents: 16840, bundleCents: 15156, savingCents: 1684 });
  });
  it('rounds half to even', () => {
    expect(bundlePrice([{ retailCents: 105, qty: 1 }], 50).bundleCents).toBe(52); // 52.5 -> 52
    expect(bundlePrice([{ retailCents: 107, qty: 1 }], 50).bundleCents).toBe(54); // 53.5 -> 54
  });
});
