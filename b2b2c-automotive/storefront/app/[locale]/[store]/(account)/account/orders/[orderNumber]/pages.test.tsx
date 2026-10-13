// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Q-06: the order, return and invoice pages answer the same 404 for an order that is not the signed-in customer's.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ load: vi.fn(), session: {} as { customerId?: string }, notFound: vi.fn() }));
vi.mock('@/lib/ct/account-order-page', () => ({ loadAccountOrder: h.load }));
vi.mock('@/lib/session', () => ({ getSession: async () => h.session }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    h.notFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined, getTranslations: async () => (key: string) => key }));
vi.mock('@/i18n/routing', async () => (await import('@/components/account/test-support')).routingMock());

import InvoicePage from './invoice/page';
import OrderPage from './page';
import ReturnPage from './return/page';

const params = (orderNumber = 'MA-ABCD2345') => Promise.resolve({ locale: 'en-US', store: 'mau-reseller-north', orderNumber });

beforeEach(() => {
  h.load.mockReset();
  h.notFound.mockReset();
  h.session = { customerId: 'c1' };
});

describe('account order pages', () => {
  it('detail of another customer gives 404', async () => {
    h.load.mockResolvedValue(null);
    await expect(OrderPage({ params: params() })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(ReturnPage({ params: params() })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(InvoicePage({ params: params() })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(h.load).toHaveBeenCalledWith('mau-reseller-north', 'en-US', 'c1', 'MA-ABCD2345');
  });
  it('the customer comes from the session, never from the address', async () => {
    h.load.mockResolvedValue(null);
    await expect(OrderPage({ params: params('MA-OTHER000') })).rejects.toThrow();
    expect(h.load.mock.calls[0][2]).toBe('c1');
  });
  it('a signed out session is a 404 (the layout redirects before this)', async () => {
    h.session = {};
    await expect(OrderPage({ params: params() })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(h.load).not.toHaveBeenCalled();
  });
  it('an unsupported locale is a 404', async () => {
    await expect(OrderPage({ params: Promise.resolve({ locale: 'fr-FR', store: 's', orderNumber: 'MA-ABCD2345' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
