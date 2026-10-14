// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { makeRequest } from './request';

describe('test helpers', () => {
  it('builds an absolute Request', () => {
    const req = makeRequest('/de-DE/x?y=1', { method: 'POST' });
    expect(req.url).toBe('http://localhost:3000/de-DE/x?y=1');
    expect(req.method).toBe('POST');
  });
});
