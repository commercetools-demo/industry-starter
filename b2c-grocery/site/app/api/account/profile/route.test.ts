// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/ct/customer', () => ({ getCustomer: vi.fn() }));

import { GET } from './route';
import { getCustomer } from '@/lib/ct/customer';
import { getSession } from '@/lib/session';

const customer = {
  id: 'cust-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  createdAt: '2023-04-01T10:00:00.000Z',
  password: 'hash-must-not-leak',
  addresses: [
    { id: 'a1', country: 'US', city: 'Austin', streetName: 'Main St 1', postalCode: '73301' },
    { id: 'a2', country: 'US', city: 'Dallas' },
  ],
  defaultShippingAddressId: 'a2',
};

beforeEach(() => vi.resetAllMocks());

describe('GET /api/account/profile', () => {
  it('Anonymous visitor: 401', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getCustomer).not.toHaveBeenCalled();
  });

  it('returns the profile with the default shipping address and nothing else', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getCustomer).mockResolvedValue(customer as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body).toMatchObject({ createdAt: '2023-04-01T10:00:00.000Z', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', defaultShippingAddress: { city: 'Dallas', country: 'US' } });
    expect(JSON.stringify(body)).not.toContain('hash-must-not-leak');
  });

  it('no default address: the field is absent', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getCustomer).mockResolvedValue({ ...customer, defaultShippingAddressId: undefined } as never);
    expect(await (await GET()).json()).not.toHaveProperty('defaultShippingAddress');
  });

  it('unknown customer: 404', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'gone' });
    vi.mocked(getCustomer).mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it('failure: private 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getCustomer).mockRejectedValue(new Error('boom'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
