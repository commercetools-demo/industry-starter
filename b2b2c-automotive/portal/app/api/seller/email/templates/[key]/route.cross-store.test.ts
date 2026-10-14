import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogError } from '@/lib/catalog/errors';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const service = vi.hoisted(() => ({ getTemplate: vi.fn(async () => ({ key: 'win-back' })), saveTemplate: vi.fn(async () => ({ key: 'win-back' })) }));
vi.mock('@/lib/ct/seller/email-templates', () => service);

import { GET, PUT } from './route';

const ctx = params({ key: 'win-back' });
const t = (s: string) => ({ 'de-DE': s, 'en-US': s });
const put = (json: Record<string, unknown>) => makeRequest('/api/seller/email/templates/win-back', { method: 'PUT', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', subject: t('Hi {{customer_name}}'), body: t('Body'), enabled: true, ...extra });

beforeEach(() => {
  asUser('adminA');
  service.getTemplate.mockClear();
  service.saveTemplate.mockClear();
});

describe('/api/seller/email/templates/[key]', () => {
  it('cross-store: another store is refused before any commercetools call', async () => {
    await expectCrossStoreForbidden((req) => PUT(req, ctx), (other) => put(body({ storeKey: other })));
    await expectCrossStoreForbidden((req) => GET(req, ctx), (other) => makeRequest(`/api/seller/email/templates/win-back?storeKey=${other}`));
    expect(service.saveTemplate).not.toHaveBeenCalled();
    expect(service.getTemplate).not.toHaveBeenCalled();
  });
  it('Buyer gets 403 on both methods', async () => {
    asUser('buyerA');
    expect((await PUT(put(body()), ctx)).status).toBe(403);
    expect((await GET(makeRequest('/api/seller/email/templates/win-back?storeKey=store-a'), ctx)).status).toBe(403);
    expect(service.saveTemplate).not.toHaveBeenCalled();
  });
  it('saves for the session store; the body is strict', async () => {
    expect((await PUT(put(body()), ctx)).status).toBe(200);
    expect(service.saveTemplate).toHaveBeenCalledWith('store-a', 'win-back', { subject: t('Hi {{customer_name}}'), body: t('Body'), enabled: true });
    for (const extra of [{ provider: 'smtp' }, { sendNow: true }, { subject: { 'de-DE': 'x' } }]) expect((await PUT(put(body(extra)), ctx)).status).toBe(400);
    expect(service.saveTemplate).toHaveBeenCalledTimes(1);
  });
  it('an unknown variable is 400 UNKNOWN_VARIABLE naming it', async () => {
    service.saveTemplate.mockRejectedValueOnce(new CatalogError(400, 'UNKNOWN_VARIABLE', 'Unknown variable foo', { variable: 'foo' }));
    const res = await PUT(put(body()), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Unknown variable foo', code: 'UNKNOWN_VARIABLE', variable: 'foo' });
  });
});
