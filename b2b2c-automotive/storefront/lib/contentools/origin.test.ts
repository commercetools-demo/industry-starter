// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { normalizeContentoolsOrigin } from './origin';

describe('normalizeContentoolsOrigin', () => {
  it('drops trailing slashes and a trailing /service so URLs do not read /service/service', () => {
    expect(normalizeContentoolsOrigin('https://c.example.test')).toBe('https://c.example.test');
    expect(normalizeContentoolsOrigin('https://c.example.test/')).toBe('https://c.example.test');
    expect(normalizeContentoolsOrigin('https://c.example.test/service')).toBe('https://c.example.test');
    expect(normalizeContentoolsOrigin(' https://c.example.test/service/ ')).toBe('https://c.example.test');
  });
});
