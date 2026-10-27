import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  listing: undefined as unknown,
  outcome: { kind: 'none' } as { kind: string; node?: unknown },
  renderPage: vi.fn(),
  getListing: vi.fn(),
  provideListing: vi.fn(),
}));

vi.mock('next-intl/server', () => ({ setRequestLocale: () => {}, getTranslations: async () => (k: string) => k }));
vi.mock('@/components/listing/ListingRoute', () => ({ default: ({ result }: { result: { kind: string } }) => <i data-native={result.kind} /> }));
vi.mock('@/lib/listing/page-data', () => ({
  getListing: (...a: unknown[]) => {
    m.getListing(...a);
    if (m.listing instanceof Error) return Promise.reject(m.listing);
    return Promise.resolve(m.listing);
  },
  listingMetadata: async () => ({}),
}));
vi.mock('@/lib/listing/request-listing', () => ({ provideListing: (p: unknown) => m.provideListing(p) }));
vi.mock('@/components/page-builder/renderPage', () => ({
  renderPage: async (...a: unknown[]) => {
    m.renderPage(...a);
    return m.outcome;
  },
}));

import CategoryPage from '@/app/[locale]/(listing)/category/[slug]/page';

const call = (sp: Record<string, string> = {}) =>
  CategoryPage({ params: Promise.resolve({ locale: 'en-US', slug: 'pods' }), searchParams: Promise.resolve(sp) }) as Promise<{ props: Record<string, unknown> }>;

beforeEach(() => {
  vi.clearAllMocks();
  m.listing = { kind: 'ok' };
  m.outcome = { kind: 'none' };
});

describe('category route', () => {
  it('starts the native listing once and shares it with the page builder components', async () => {
    m.outcome = { kind: 'page', node: <p>authored</p> };
    await call({ f_roast: 'dark' });
    expect(m.getListing).toHaveBeenCalledTimes(1);
    expect(m.getListing).toHaveBeenCalledWith('en-US', 'category', 'pods', { f_roast: 'dark' });
    expect(m.provideListing).toHaveBeenCalledTimes(1);
  });

  it('asks the page builder for /category/<slug> and forwards the query string untouched', async () => {
    await call({ f_roast: 'dark', sort: 'price-asc', page: '2', pb_preview: 't' });
    expect(m.renderPage).toHaveBeenCalledWith({
      locale: 'en-US',
      segments: ['category', 'pods'],
      searchParams: { f_roast: 'dark', sort: 'price-asc', page: '2', pb_preview: 't' },
    });
  });

  it('a published page replaces the native layout', async () => {
    m.outcome = { kind: 'page', node: <p>authored</p> };
    const ui = await call();
    expect((ui.props.children as { props: { children: string } }).props.children).toBe('authored');
  });

  it.each(['none', 'failed'])('page builder outcome %s renders the native listing', async (kind) => {
    m.outcome = { kind };
    expect((await call()).props.result).toEqual({ kind: 'ok' });
  });

  it.each(['redirect', 'unsupported_language'])('a native %s wins over an authored page', async (kind) => {
    m.listing = { kind };
    m.outcome = { kind: 'page', node: <p>authored</p> };
    expect((await call()).props.result).toEqual({ kind });
  });

  it('an unknown category is the native not-found, whatever the page builder holds', async () => {
    m.listing = new Error('NEXT_NOT_FOUND');
    m.outcome = { kind: 'page', node: <p>authored</p> };
    await expect(call()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
