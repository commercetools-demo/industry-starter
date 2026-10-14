// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_TOKEN, placeholderJwt } from './placeholder';

describe('placeholder token', () => {
  it('placeholder token contains no sub claim', () => {
    const parts = placeholderJwt().split('.');
    expect(parts).toHaveLength(3);
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('sub');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000 + 10 * 365 * 24 * 3600 - 1);
    expect(PLACEHOLDER_TOKEN).not.toMatch(/\./);
  });
});
