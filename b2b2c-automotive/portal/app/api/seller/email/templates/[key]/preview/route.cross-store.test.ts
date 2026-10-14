import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrossStoreForbidden } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const brand = vi.hoisted(() => vi.fn(async () => ({ primary: '#112233', logoUrl: null, storeName: 'Store A' })));
vi.mock('@/lib/theme/brand', () => ({ getBrand: brand }));

import { POST } from './route';

const ctx = params({ key: 'order-confirmation' });
const t = (s: string) => ({ 'de-DE': s, 'en-US': s });
const post = (json: Record<string, unknown>) => makeRequest('/api/seller/email/templates/order-confirmation/preview', { method: 'POST', json });
const body = (extra: Record<string, unknown> = {}) => ({ storeKey: 'store-a', subject: t('Your order {{order_number}} is confirmed'), body: t('Hi {{customer_name}}'), ...extra });

beforeEach(() => {
  asUser('adminA');
  brand.mockClear();
});

describe('POST /api/seller/email/templates/[key]/preview', () => {
  it('cross-store and Buyer are refused before the brand is read', async () => {
    await expectCrossStoreForbidden((req) => POST(req, ctx), (other) => post(body({ storeKey: other })));
    asUser('buyerA');
    expect((await POST(post(body()), ctx)).status).toBe(403);
    expect(brand).not.toHaveBeenCalled();
  });
  it('renders the sample order and returns the brand; stores nothing', async () => {
    const res = await POST(post(body()), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subject['en-US']).toBe('Your order MO-482913 is confirmed');
    expect(data.html['en-US']).toBe('Hi Alex Muster');
    expect(data.brand.primary).toBe('#112233');
  });
  it('an unknown variable is 400 naming it; an unknown template is 404', async () => {
    const res = await POST(post(body({ subject: t('{{foo}}') })), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'UNKNOWN_VARIABLE', variable: 'foo' });
    expect((await POST(post(body()), params({ key: 'nope' }))).status).toBe(404);
  });
});
