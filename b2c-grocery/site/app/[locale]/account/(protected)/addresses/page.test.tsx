import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import AddressesPage from './page';

vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default as Record<string, unknown>;
  const lookup = (namespace: string) => (key: string) => {
    const value = `${namespace}.${key}`.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
    return typeof value === 'string' ? value : `${namespace}.${key}`;
  };
  return { setRequestLocale: vi.fn(), getTranslations: async ({ namespace }: { namespace: string }) => lookup(namespace) };
});

afterEach(() => vi.unstubAllGlobals());

describe('/account/addresses', () => {
  it('heading, address cards and the rail with Addresses marked active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ addresses: [{ id: 'a1', firstName: 'Ada', lastName: 'L', streetName: '1 Main', postalCode: '94105', city: 'SF', country: 'US', isDefaultShipping: true, isDefaultBilling: true }] }),
          { status: 200 },
        ),
      ),
    );
    renderWithProviders(await AddressesPage({ params: Promise.resolve({ locale: 'en-US' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Addresses' })).toBeInTheDocument();
    expect(await screen.findByText('Default')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Addresses/, current: 'page' })).toHaveAttribute('href', '/en-US/account/addresses');
  });
});
