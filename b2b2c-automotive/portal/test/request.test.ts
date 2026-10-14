/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { makeRequest } from './request';

describe('test helpers', () => {
  it('builds an absolute Request', async () => {
    const req = makeRequest('/api/x', { method: 'POST', json: { a: 1 }, cookie: 'k=v' });
    expect(req.url).toBe('http://localhost:3000/api/x');
    expect(req.headers.get('cookie')).toBe('k=v');
    expect(await req.json()).toEqual({ a: 1 });
  });
});
