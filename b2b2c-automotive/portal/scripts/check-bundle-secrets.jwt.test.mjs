// @vitest-environment node
// Workstream X-12: a JWT-shaped string (the canary) in the client bundle fails the scan.
import { describe, expect, it } from 'vitest';
import { scanBundle } from './check-bundle-secrets.mjs';
import { tmp } from './test-utils.mjs';

const CANARY = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9.CANARY-SIGNATURE-0123456789';

describe('no jwt shape in bundle', () => {
  it('a bundle holding the canary fails', () => {
    expect(scanBundle(tmp({ 'chunks/a.js': `var t="${CANARY}";` }), []).join('\n')).toMatch(/a\.js contains a JWT-shaped string/);
  });
  it('ordinary base64 text and short eyJ prefixes pass', () => {
    expect(scanBundle(tmp({ 'chunks/a.js': 'var a="eyJhbGci", b="abc.def.ghi";' }), [])).toEqual([]);
  });
});
