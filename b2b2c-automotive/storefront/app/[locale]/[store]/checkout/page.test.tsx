// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';

class Redirected extends Error {
  constructor(readonly target: unknown) {
    super('NEXT_REDIRECT');
  }
}
const state = vi.hoisted(() => ({ session: {} as Session }));
const loadCartView = vi.hoisted(() => vi.fn());
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/i18n/routing', () => ({
  redirect: (target: unknown) => {
    throw new Redirected(target);
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined, getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: async () => null }));
vi.mock('@/lib/ct/cart-view', () => ({ loadCartView }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));
vi.mock('@/components/checkout/CheckoutPage', () => ({ CheckoutPage: () => null }));

import Page, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'en-US', store: 'mau-reseller-north' });
const search = (query: Record<string, string> = {}) => Promise.resolve(query);
const line = (available: number) => ({ id: 'li-1', stock: { available } });
const cart = (lines = [line(3)], selected: 'pickup' | 'ship' = 'pickup') => ({ cart: { lines, delivery: { selected } }, drop: false });
const branch = { key: 'mau-br-north-berlin', channelId: 'ch-b', name: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] } };

beforeEach(() => {
  state.session = { storeKey: 'mau-reseller-north', cartId: 'cart-1', branchKey: 'mau-br-north-berlin' };
  loadCartView.mockReset().mockResolvedValue(cart());
  getShellContext.mockReset().mockResolvedValue({ branches: [branch], retailChannelId: 'ch-r' });
});
afterEach(() => vi.unstubAllEnvs());

const render = async (query?: Record<string, string>) => (await Page({ params, searchParams: search(query) })) as { props: Record<string, unknown> };

describe('checkout page', () => {
  it('redirects to cart when the cart is empty', async () => {
    loadCartView.mockResolvedValue(cart([]));
    await expect(render()).rejects.toMatchObject({ target: { href: '/mau-reseller-north/cart', locale: 'en-US' } });
  });
  it('redirects to cart without a cart in the session', async () => {
    state.session = { storeKey: 'mau-reseller-north' };
    await expect(render()).rejects.toBeInstanceOf(Redirected);
    expect(loadCartView).not.toHaveBeenCalled();
  });
  it('redirects to cart when a line is capped to zero', async () => {
    loadCartView.mockResolvedValue(cart([line(2), line(0)]));
    await expect(render()).rejects.toBeInstanceOf(Redirected);
  });
  it('redirects to cart when the cart read fails or the cart is gone', async () => {
    loadCartView.mockResolvedValue({ cart: null, drop: true });
    await expect(render()).rejects.toBeInstanceOf(Redirected);
    loadCartView.mockRejectedValue(new Error('down'));
    await expect(render()).rejects.toBeInstanceOf(Redirected);
  });
  it('a guest reaches the page: no customer is needed', async () => {
    const element = await render();
    expect(element.props).toMatchObject({ store: 'mau-reseller-north', cancelled: false, devComplete: false });
  });
  it('pickup preset carries the branch facts', async () => {
    const element = await render();
    expect(element.props.pickup).toEqual({ branchName: 'Malva Berlin', address: branch.address, hours: branch.hours });
  });
  it('ship preset carries none', async () => {
    loadCartView.mockResolvedValue(cart([line(3)], 'ship'));
    expect((await render()).props.pickup).toBeNull();
  });
  it('the cancelled return is passed on', async () => {
    expect((await render({ status: 'cancelled' })).props.cancelled).toBe(true);
  });
  it('an unknown store is a 404', async () => {
    getShellContext.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('the dev panel needs the flag, and a missing application key or ?dev=1', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CHECKOUT_DEV_COMPLETE', 'true');
    vi.stubEnv('CTP_CHECKOUT_APP_KEY', '');
    expect((await render()).props.devComplete).toBe(true);
    vi.stubEnv('CTP_CHECKOUT_APP_KEY', 'malva-app');
    expect((await render()).props.devComplete).toBe(false);
    expect((await render({ dev: '1' })).props.devComplete).toBe(true);
  });
  it('never offers the dev panel in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CHECKOUT_DEV_COMPLETE', 'true');
    vi.stubEnv('CTP_CHECKOUT_APP_KEY', '');
    expect((await render({ dev: '1' })).props.devComplete).toBe(false);
  });
  it('is noindex', async () => {
    expect((await generateMetadata({ params, searchParams: search() }))?.robots).toEqual({ index: false, follow: false });
  });
});
