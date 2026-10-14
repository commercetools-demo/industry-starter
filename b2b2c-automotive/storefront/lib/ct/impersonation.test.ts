// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const objectGet = vi.hoisted(() => vi.fn());
const objectPost = vi.hoisted(() => vi.fn());
const customerGet = vi.hoisted(() => vi.fn());
const stores = vi.hoisted(() => [] as string[]);
vi.mock('./client', () => ({
  apiRoot: {
    customObjects: () => ({
      withContainerAndKey: (a: unknown) => ({ get: () => ({ execute: () => objectGet(a) }) }),
      post: (a: unknown) => ({ execute: () => objectPost(a) }),
    }),
  },
  projectKey: 'p',
}));
vi.mock('./in-store', () => ({
  inStore: (storeKey: string) => {
    stores.push(storeKey);
    return { customers: () => ({ withId: (a: unknown) => ({ get: () => ({ execute: () => customerGet(a) }) }) }) };
  },
}));

import { claimHandoff, endRecord, getImpersonatedName, getRecordStatus, IMPERSONATION_CONTAINER } from './impersonation';

const claims = { customerId: 'cust-1', storeKey: 'mau-reseller-north', actorId: 'seller-1', jti: 'jti-1' };
const record = (over: Record<string, unknown> = {}, version = 3) => ({
  body: { container: IMPERSONATION_CONTAINER, key: 'jti-1', version, value: { customerId: 'cust-1', storeKey: 'mau-reseller-north', actorId: 'seller-1', createdAt: '2026-10-12T10:00:00.000Z', status: 'issued', ...over } },
});

beforeEach(() => {
  for (const m of [objectGet, objectPost, customerGet]) m.mockReset();
  stores.length = 0;
  customerGet.mockResolvedValue({ body: { id: 'cust-1', firstName: 'Anna', lastName: 'Meyer' } });
  objectPost.mockResolvedValue({ body: {} });
});

describe('claimHandoff: single use', () => {
  it('an issued record of this customer and store becomes active, version guarded', async () => {
    objectGet.mockResolvedValue(record());
    expect(await claimHandoff(claims)).toBe(true);
    expect(objectGet).toHaveBeenCalledWith({ container: 'malva-impersonation', key: 'jti-1' });
    expect(objectPost.mock.calls[0][0].body).toMatchObject({ container: 'malva-impersonation', key: 'jti-1', version: 3, value: { status: 'active', actorId: 'seller-1' } });
    expect(stores).toEqual(['mau-reseller-north']);
  });
  it('the second use is refused: the record is not issued any more', async () => {
    objectGet.mockResolvedValue(record({ status: 'active' }));
    expect(await claimHandoff(claims)).toBe(false);
    expect(objectPost).not.toHaveBeenCalled();
  });
  it('an ended record is refused', async () => {
    objectGet.mockResolvedValue(record({ status: 'ended' }));
    expect(await claimHandoff(claims)).toBe(false);
  });
  it('two requests racing for one token: the loser gets a version conflict and is refused', async () => {
    objectGet.mockResolvedValue(record());
    objectPost.mockRejectedValue({ statusCode: 409 });
    expect(await claimHandoff(claims)).toBe(false);
  });
  it('no record, another store, another customer or another actor is refused', async () => {
    objectGet.mockRejectedValueOnce({ statusCode: 404 });
    expect(await claimHandoff(claims)).toBe(false);
    objectGet.mockResolvedValueOnce(record({ storeKey: 'mau-reseller-south' }));
    expect(await claimHandoff(claims)).toBe(false);
    objectGet.mockResolvedValueOnce(record({ customerId: 'cust-2' }));
    expect(await claimHandoff(claims)).toBe(false);
    objectGet.mockResolvedValueOnce(record({ actorId: 'seller-9' }));
    expect(await claimHandoff(claims)).toBe(false);
    expect(objectPost).not.toHaveBeenCalled();
  });
  it('a customer that is not in the store (the in-store endpoint answers 404) is refused', async () => {
    objectGet.mockResolvedValue(record());
    customerGet.mockRejectedValue({ statusCode: 404 });
    expect(await claimHandoff(claims)).toBe(false);
    expect(objectPost).not.toHaveBeenCalled();
  });
  it('other failures are not swallowed', async () => {
    objectGet.mockRejectedValue({ statusCode: 503 });
    await expect(claimHandoff(claims)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('record status and end', () => {
  it('reads the status; a missing record or an outage is undefined (the deadlines still apply)', async () => {
    objectGet.mockResolvedValueOnce(record({ status: 'ended' }));
    expect(await getRecordStatus('jti-1')).toBe('ended');
    objectGet.mockRejectedValueOnce({ statusCode: 404 });
    expect(await getRecordStatus('jti-1')).toBeUndefined();
    objectGet.mockRejectedValueOnce({ statusCode: 503 });
    expect(await getRecordStatus('jti-1')).toBeUndefined();
  });
  it('a malformed id is not read', async () => {
    expect(await getRecordStatus('a/b')).toBeUndefined();
    expect(objectGet).not.toHaveBeenCalled();
  });
  it('ending writes status ended and keeps the other values; an ended or missing record writes nothing', async () => {
    objectGet.mockResolvedValueOnce(record({ status: 'active' }));
    await endRecord('jti-1');
    expect(objectPost.mock.calls[0][0].body.value).toMatchObject({ status: 'ended', customerId: 'cust-1', actorId: 'seller-1' });
    objectPost.mockClear();
    objectGet.mockResolvedValueOnce(record({ status: 'ended' }));
    await endRecord('jti-1');
    objectGet.mockRejectedValueOnce({ statusCode: 404 });
    await endRecord('jti-1');
    expect(objectPost).not.toHaveBeenCalled();
  });
  it('ending never throws (best effort)', async () => {
    objectGet.mockRejectedValue({ statusCode: 503 });
    await expect(endRecord('jti-1')).resolves.toBeUndefined();
  });
});

describe('getImpersonatedName', () => {
  it('first name and the initial of the last name, never the e-mail', async () => {
    expect(await getImpersonatedName('mau-reseller-north', 'cust-1')).toBe('Anna M');
    customerGet.mockResolvedValue({ body: { id: 'cust-1', email: 'x@example.com' } });
    expect(await getImpersonatedName('mau-reseller-north', 'cust-1')).toBeNull();
  });
});
