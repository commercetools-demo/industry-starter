import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ reconcileAssortment: vi.fn(async () => ({ removed: ['MLV-HL-56002'] })) }));
vi.mock('@/lib/ct/seller/assortment-write', () => service);

import { POST } from './route';

const post = (storeKey: string) => makeRequest('/api/seller/assortment/reconcile', { method: 'POST', json: { storeKey } });

beforeEach(() => {
  asUser('adminA');
  service.reconcileAssortment.mockClear();
});

describe('POST /api/seller/assortment/reconcile', () => {
  it('cross-store: another store is refused and commercetools is never called', async () => {
    await expectCrossStoreForbidden((req) => POST(req), (other) => post(other));
    expect(service.reconcileAssortment).not.toHaveBeenCalled();
  });

  it('the own store reconciles; a Buyer is refused', async () => {
    expect(await (await POST(post('store-a'))).json()).toEqual({ removed: ['MLV-HL-56002'] });
    asUser('buyerA');
    expect((await POST(post('store-a'))).status).toBe(403);
  });
});
