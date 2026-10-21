import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { podPage } from '@/test/pdp';
import type { ProductSummary } from '@/lib/types';

const h = vi.hoisted(() => ({ related: vi.fn(), goes: vi.fn(), ctx: vi.fn() }));
vi.mock('@/lib/related', () => ({ getRelatedProducts: h.related, getCompatibleCapsules: h.goes, getRelatedContext: h.ctx }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => ({ title: 'You may also like', goesWith: 'Goes well with' })[key] ?? key,
}));
vi.mock('@/components/listing/ProductGrid', () => ({
  default: ({ products }: { products: ProductSummary[] }) => (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  ),
}));

import RelatedStrip from '@/components/pdp/RelatedStrip';

const card = (id: string): ProductSummary => ({ id, name: `Card ${id}` }) as ProductSummary;
const product = podPage().product;
const run = async () => render(await RelatedStrip({ product, locale: 'en-US' }));

beforeEach(() => {
  h.related.mockReset().mockResolvedValue([card('a'), card('b'), card('c'), card('d')]);
  h.goes.mockReset().mockResolvedValue([]);
  h.ctx.mockReset().mockResolvedValue({ locale: 'en-US', country: 'US', currency: 'USD' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('RelatedStrip', () => {
  it('shows four related cards under You may also like', async () => {
    await run();
    const strip = screen.getByTestId('related');
    expect(within(strip).getByRole('heading', { name: 'You may also like' })).toBeInTheDocument();
    expect(within(strip).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByTestId('goes-with')).toBeNull();
  });

  it('Goes well with comes first on a machine page', async () => {
    h.goes.mockResolvedValue([card('cap1'), card('cap2')]);
    await run();
    const goes = screen.getByTestId('goes-with');
    const related = screen.getByTestId('related');
    expect(within(goes).getByText('Card cap1')).toBeInTheDocument();
    expect(goes.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('related failure omits the strip and keeps the other', async () => {
    h.related.mockRejectedValue(new Error('search down'));
    h.goes.mockResolvedValue([card('cap1')]);
    await run();
    expect(screen.queryByTestId('related')).toBeNull();
    expect(screen.getByTestId('goes-with')).toBeInTheDocument();
  });

  it('both reads failing renders nothing and never throws', async () => {
    h.related.mockRejectedValue(new Error('x'));
    h.goes.mockRejectedValue(new Error('y'));
    const { container } = await run();
    expect(container).toBeEmptyDOMElement();
  });

  it('a failing context read renders nothing', async () => {
    h.ctx.mockRejectedValue(new Error('session'));
    expect(await RelatedStrip({ product, locale: 'en-US' })).toBeNull();
  });

  it('empty results omit their section', async () => {
    h.related.mockResolvedValue([]);
    const { container } = await run();
    expect(container).toBeEmptyDOMElement();
  });
});
