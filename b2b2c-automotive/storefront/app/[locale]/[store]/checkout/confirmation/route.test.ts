// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { makeRequest } from '@/test/request';
import { GET } from './route';

const ID = '3f1c0c52-1111-4222-8333-944455556666';
const get = (query: string) => GET(makeRequest(`/en-US/mau-reseller-north/checkout/confirmation${query}`));

describe('confirmation alias', () => {
  it('orderId redirects to the return route, the resolver that makes the numbered url', async () => {
    const res = await get(`?orderId=${ID}`);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe(`/checkout/return?orderId=${ID}`);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('orderNumber redirects the same way', async () => {
    const res = await get('?orderNumber=MA-0123ABCD');
    expect(res.headers.get('Location')).toBe('/checkout/return?orderNumber=MA-0123ABCD');
  });
  it('missing parameters gets 404', async () => {
    expect((await get('')).status).toBe(404);
  });
  it('a malformed id or number gets 404 and is never passed on', async () => {
    expect((await get('?orderId=x%26next%3D%2F%2Fevil')).status).toBe(404);
    expect((await get('?orderNumber=AL-48213')).status).toBe(404);
  });
});
