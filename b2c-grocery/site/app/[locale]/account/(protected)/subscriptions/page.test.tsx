import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summary } from '@/test/recurring';
import { renderWithProviders } from '@/test/utils';
import SubscriptionsPage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  subscriptionsEnabled: vi.fn(() => true),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('@/lib/config/features', async (orig) => ({ ...(await orig<typeof import('@/lib/config/features')>()), subscriptionsEnabled: mocks.subscriptionsEnabled }));
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), notFound: mocks.notFound }));
vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default as Record<string, unknown>;
  const lookup = (namespace: string) => (key: string) => {
    const value = `${namespace}.${key}`.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
    return typeof value === 'string' ? value : `${namespace}.${key}`;
  };
  return { setRequestLocale: vi.fn(), getTranslations: async ({ namespace }: { namespace: string }) => lookup(namespace) };
});

beforeEach(() => {
  mocks.subscriptionsEnabled.mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ recurringOrders: [summary()], policies: [] }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

const params = Promise.resolve({ locale: 'en-US' });

describe('/account/subscriptions', () => {
  it('heading, the recurring order card and the rail with Subscriptions marked active', async () => {
    renderWithProviders(await SubscriptionsPage({ params }));
    expect(screen.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeInTheDocument();
    expect(await screen.findByTestId('subscription-card')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Subscriptions/, current: 'page' })).toHaveAttribute('href', '/en-US/account/subscriptions');
  });

  it('flag off: 404', async () => {
    mocks.subscriptionsEnabled.mockReturnValue(false);
    await expect(SubscriptionsPage({ params })).rejects.toThrow('NOT_FOUND');
  });

  it('metadata title', async () => {
    expect(await generateMetadata({ params })).toEqual({ title: 'Subscriptions' });
  });
});
