// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scanBundle, secretValues } from './check-bundle-secrets.mjs';
import { tmpApp } from './test-utils.mjs';

describe('BFF boundary: Secret in the bundle', () => {
  it('a clean bundle passes', () => {
    expect(scanBundle(tmpApp({ 'chunks/a.js': 'console.log("hi")' }), ['s3cr3t-value-xyz'])).toEqual([]);
  });
  it('Secret in the bundle: a seeded fake value is found', () => {
    expect(scanBundle(tmpApp({ 'chunks/a.js': 'x="s3cr3t-value-xyz"' }), ['s3cr3t-value-xyz'])).toEqual(['chunks/a.js contains a secret value']);
  });
  it('the word client_secret is found', () => {
    expect(scanBundle(tmpApp({ 'b.js': 'const client_secret = 1' }), [])).toEqual(['b.js contains "client_secret"']);
  });
  it('reads secrets from the environment and an env file, ignoring short values', () => {
    const values = secretValues({ SESSION_SECRET: 'abcdefghijkl' }, 'CTP_CLIENT_SECRET="longsecretvalue"\nCTP_CLIENT_ID=ab');
    expect(values.sort()).toEqual(['abcdefghijkl', 'longsecretvalue']);
  });
});
