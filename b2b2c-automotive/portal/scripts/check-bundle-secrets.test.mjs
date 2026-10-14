/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { scanBundle, secretValues } from './check-bundle-secrets.mjs';
import { tmp } from './test-utils.mjs';

describe('Secret in the bundle', () => {
  it('Secret in the bundle is reported by file', () => {
    const dir = tmp({ 'chunks/a.js': 'var k="s3cr3t-value-1234";', 'chunks/b.js': 'clean' });
    expect(scanBundle(dir, ['s3cr3t-value-1234'])).toEqual(['chunks/a.js contains a secret value']);
  });
  it('reports the word client_secret', () => {
    expect(scanBundle(tmp({ 'a.js': 'x.client_secret' }), [])).toEqual(['a.js contains "client_secret"']);
  });
  it('ignores values shorter than 8 characters and reads .env.local', () => {
    expect(secretValues({ SESSION_SECRET: 'short' })).toEqual([]);
    expect(secretValues({}, 'CTP_ADMIN_CLIENT_SECRET="abcdefgh12"\nCTP_CLIENT_SECRET=\n')).toEqual(['abcdefgh12']);
  });
  it('passes on a missing bundle directory', () => {
    expect(scanBundle(tmp({}) + '/nope', ['abcdefgh'])).toEqual([]);
  });
});
