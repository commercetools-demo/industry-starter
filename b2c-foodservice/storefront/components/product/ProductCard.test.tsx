import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import type { ProductSummary, Store } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { nav, renderShell, stubFetch } from '@/test/shell';
import { useCollectionStore } from '@/hooks/useCollectionStore';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import ProductCard from '@/components/product/ProductCard';

const store = (key: string, name: string): Store => ({
  id: key, key, name, addressLine: '1 Main St', city: 'New York', postalCode: '10001', country: 'US',
  hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15,
});
const STORES = [store('mcf-store-nyc-soho', 'Malva SoHo')];
const fallback = (selectedKey: string | null, country = 'US') => ({
  [unstable_serialize(keyChannels(country))]: { stores: country === 'US' ? STORES : [], selectedKey },
});

const pod: ProductSummary = {
  id: 'p-1', slug: 'ember-ristretto', sku: 'MCF-POD-EMBER-10', name: 'Ember Ristretto', categoryName: 'Pods',
  imageAlt: 'Ember Ristretto', badge: 'bestseller',
  price: { from: { centAmount: 490, currencyCode: 'USD' }, fromIsRange: false },
  unit: { money: { centAmount: 49, currencyCode: 'USD' }, perKey: 'capsule' },
  label: { kind: 'intensity', value: '12' }, requiredChoice: null,
  rating: { average: 4.6, count: 12 }, availability: { state: 'in' },
};

function Probe() {
  const { isOpen } = useCollectionStore();
  return <output data-testid="picker">{String(isOpen)}</output>;
}

beforeEach(() => {
  nav.push.mockReset();
  window.sessionStorage.clear();
  stubFetch({
    '/api/channels': () => ({ stores: STORES, selectedKey: 'mcf-store-nyc-soho' }),
    '/api/cart/count': () => ({ count: 0 }),
    '/api/cart/lines': () => ({ cart: { id: 'c1', version: 2, count: 1, lines: [{ id: 'l1', sku: pod.sku, quantity: 1 }] } }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('ProductCard', () => {
  it('Hover reveals heart and quick add within 200ms (state classes, focus-within too)', () => {
    renderShell(<ProductCard product={pod} />, { fallback: fallback('mcf-store-nyc-soho') });
    const quick = screen.getByTestId('quick-add');
    expect(quick.className).toContain('group-hover:translate-y-0');
    expect(quick.className).toContain('group-focus-within:translate-y-0');
    const heart = screen.getByRole('button', { name: 'Save Ember Ristretto' });
    expect(heart.className).toContain('group-hover:opacity-100');
    expect(heart.className).toContain('group-focus-within:opacity-100');
    expect(quick.className).toContain('transition-state');
  });

  it('Touch shows heart and quick add always', () => {
    renderShell(<ProductCard product={pod} />, { fallback: fallback(null) });
    expect(screen.getByTestId('quick-add').className).toContain('[@media(hover:none)]:translate-y-0');
    expect(screen.getByRole('button', { name: 'Save Ember Ristretto' }).className).toContain('[@media(hover:none)]:opacity-100');
  });

  it('Card is a single click target for the detail page', () => {
    renderShell(<ProductCard product={pod} />, { fallback: fallback('mcf-store-nyc-soho') });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/p/ember-ristretto/MCF-POD-EMBER-10');
    const article = screen.getByTestId('product-card');
    expect(article.querySelector('a button, button a')).toBeNull();
    expect(article).toHaveAttribute('data-price', '490');
  });

  it('Pods show sleeve price per capsule and intensity label', () => {
    renderShell(<ProductCard product={pod} />, { fallback: fallback(null) });
    expect(screen.getByText('$4.90')).toBeInTheDocument();
    expect(screen.getByText('$0.49 per capsule')).toBeInTheDocument();
    expect(screen.getByText('Intensity 12')).toBeInTheDocument();
    expect(screen.getByText('Bestseller')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /4\.6/ })).toBeInTheDocument();
  });

  it('From price shows the From prefix', () => {
    renderShell(<ProductCard product={{ ...pod, price: { from: { centAmount: 490, currencyCode: 'USD' }, fromIsRange: true } }} />, { fallback: fallback(null) });
    expect(screen.getByText('From $4.90')).toBeInTheDocument();
  });

  it('Out at the store reads Not available and stays openable', () => {
    renderShell(<ProductCard product={{ ...pod, availability: { state: 'out' } }} />, { fallback: fallback('mcf-store-nyc-soho') });
    expect(screen.getByText('Not available at Malva SoHo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ember Ristretto' })).toBeInTheDocument();
    expect(screen.getByTestId('quick-add')).toBeEnabled();
  });

  it('No store shows Choose a store link that opens the picker', async () => {
    stubFetch({ '/api/channels': () => ({ stores: STORES, selectedKey: null }) });
    renderShell(<><ProductCard product={{ ...pod, availability: null }} /><Probe /></>, { fallback: fallback(null) });
    await userEvent.click(screen.getByRole('button', { name: 'Choose a store' }));
    expect(screen.getByTestId('picker')).toHaveTextContent('true');
  });

  it('Canada card has no availability line and no Choose a store link', () => {
    renderShell(<ProductCard product={{ ...pod, availability: null, price: { from: { centAmount: 670, currencyCode: 'CAD' }, fromIsRange: false } }} />, {
      locale: 'en-CA', fallback: fallback(null, 'CA'),
    });
    expect(screen.queryByText('Choose a store')).toBeNull();
    expect(screen.queryByText(/stock at/)).toBeNull();
    expect(screen.getByText('$6.70')).toBeInTheDocument();
  });

  it('No price shows no price and disables quick add', () => {
    renderShell(<ProductCard product={{ ...pod, price: null, unit: undefined }} />, { fallback: fallback(null) });
    expect(screen.getByText('No price available')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add')).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ember Ristretto' })).toBeInTheDocument();
  });

  it('Required choice opens the detail page and adds nothing', async () => {
    const { fn } = stubFetch({ '/api/channels': () => ({ stores: STORES, selectedKey: null }), '/api/cart/lines': () => ({}) });
    renderShell(<ProductCard product={{ ...pod, requiredChoice: 'grind', sku: 'MCF-COF-HOUSE-250-WB', slug: 'house' }} />, { fallback: fallback(null) });
    await userEvent.click(screen.getByTestId('quick-add'));
    expect(nav.push).toHaveBeenCalledWith('/p/house/MCF-COF-HOUSE-250-WB?choose=grind');
    expect(fn.mock.calls.some(([u]) => String(u).includes('/api/cart/lines'))).toBe(false);
  });

  it('Quick add adds the default variant as ship and toasts', async () => {
    const { calls } = stubFetch({
      '/api/channels': () => ({ stores: STORES, selectedKey: null }),
      '/api/cart/lines': () => ({ cart: { id: 'c1', version: 2, count: 1, lines: [] } }),
    });
    renderShell(<ProductCard product={pod} />, { fallback: fallback(null) });
    await userEvent.click(screen.getByTestId('quick-add'));
    expect(await screen.findByText('Added to bag')).toBeInTheDocument();
    const call = calls.find((c) => c.url.includes('/api/cart/lines'))!;
    expect(call.init?.method).toBe('POST');
    expect(JSON.parse(String(call.init?.body))).toEqual({ sku: pod.sku, quantity: 1, fulfilment: 'delivery' });
  });

  it('Quick add failure toasts an error', async () => {
    stubFetch({
      '/api/channels': () => ({ stores: STORES, selectedKey: null }),
      '/api/cart/lines': () => Response.json({ error: { code: 'validation_failed', message: 'x' } }, { status: 422 }),
    });
    renderShell(<ProductCard product={pod} />, { fallback: fallback(null) });
    await userEvent.click(screen.getByTestId('quick-add'));
    expect(await screen.findByText(/couldn.t add that/)).toBeInTheDocument();
  });

  it('Guest save kept for the session and heart does not navigate', async () => {
    renderShell(<ProductCard product={pod} />, { fallback: fallback(null) });
    const heart = screen.getByRole('button', { name: 'Save Ember Ristretto' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));
    expect(JSON.parse(window.sessionStorage.getItem('mcf-saved') ?? '[]')).toEqual(['p-1']);
    expect(nav.push).not.toHaveBeenCalled();
    await userEvent.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'false');
  });

  it('colour swatches and matched SKU show', () => {
    renderShell(
      <ProductCard product={{ ...pod, swatches: [{ key: 'black', name: 'Black' }, { key: 'red', name: 'Red' }], matchedSku: 'MCF-X' }} />,
      { fallback: fallback(null) },
    );
    expect(screen.getByRole('img', { name: 'Black' })).toBeInTheDocument();
    expect(screen.getByText('Matched SKU MCF-X')).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    const { container } = renderShell(<ProductCard product={pod} />, { fallback: fallback('mcf-store-nyc-soho') });
    await expectNoAxeViolations(container);
  });
});
