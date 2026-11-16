// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ct/client', () => ({ apiRoot: {} }));
vi.mock('@/lib/ct/cart', () => {
  class LineRejected extends Error {
    constructor(readonly code: string, readonly status: number, readonly extra: Record<string, unknown> = {}) {
      super(code);
    }
  }
  return { LineRejected, addLine: async () => null, changeQuantity: async () => null, getCartForSession: async () => null, getCartView: async () => null, removeLine: async () => null };
});

import { LineRejected } from '@/lib/ct/cart';
import { toToolError } from '@/lib/ct/assistant-backend';
import { Unavailable } from '@/lib/agent/shopping/backend';

describe('bundle refusals on the other surfaces (V-19)', () => {
  it('the shopping assistant turns a bare bundle add into its normal "cannot add" answer, not a crash', () => {
    const err = toToolError(new LineRejected('bundle_requires_preset', 422));
    expect(err).toBeInstanceOf(Unavailable);
    expect(err.message).toContain('bundle_requires_preset');
  });
});
