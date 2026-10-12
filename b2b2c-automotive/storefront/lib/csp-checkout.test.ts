// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCsp } from '@/lib/csp';

const directive = (csp: string, name: string): string[] =>
  (csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? []);

describe('CSP for the hosted Checkout (workstream O)', () => {
  it('adds nothing without a checkout region', () => {
    const csp = buildCsp();
    expect(csp).not.toMatch(/checkout|stripe/i);
    expect(directive(csp, 'frame-src')).toEqual([]);
  });
  it('allows the Checkout script, API and Stripe frames for the region only', () => {
    const csp = buildCsp({ checkoutRegion: 'europe-west1.gcp' });
    expect(directive(csp, 'script-src')).toEqual(expect.arrayContaining(['https://app.checkout.europe-west1.gcp.commercetools.com', 'https://js.stripe.com']));
    expect(directive(csp, 'connect-src')).toEqual(expect.arrayContaining(["'self'", 'https://checkout.europe-west1.gcp.commercetools.com', 'https://api.stripe.com']));
    expect(directive(csp, 'frame-src')).toEqual(expect.arrayContaining(['https://js.stripe.com', 'https://hooks.stripe.com']));
    expect(csp).not.toContain('us-central1');
  });
  it('a local stand-in origin is added everywhere the app needs it, only when given', () => {
    const csp = buildCsp({ checkoutDevOrigin: 'http://localhost:4051' });
    for (const name of ['script-src', 'connect-src', 'frame-src', 'img-src']) expect(directive(csp, name)).toContain('http://localhost:4051');
    expect(buildCsp()).not.toContain('localhost');
  });
  it('keeps the strict defaults', () => {
    const csp = buildCsp({ checkoutRegion: 'europe-west1.gcp' });
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(csp).not.toContain('unsafe-eval');
  });
});
