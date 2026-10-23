import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { product } from '@/components/home/home-fixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { ProductSectionSkeleton } from '@/components/home/HomeSkeletons';
import ProductSection from '@/components/home/ProductSection';

const four = [1, 2, 3, 4].map((n) => product({ id: `p-${n}`, slug: `p-${n}`, sku: `SKU-${n}`, name: `Product ${n}` }));

describe('ProductSection', () => {
  it('Bestsellers renders four cards with View all link', () => {
    stubFetch({ '/api/cart/count': () => ({ count: 0 }) });
    renderShell(<ProductSection id="home-bestsellers" eyebrow="Most loved" title="Bestsellers" viewAllHref="/shop?f_collection=bestseller" products={four} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Bestsellers' })).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/shop?f_collection=bestseller');
  });

  it('No new products: the New arrivals section is absent', () => {
    renderShell(<ProductSection id="home-new" eyebrow="Just landed" title="New arrivals" viewAllHref="/shop?f_collection=new" products={[]} />);
    expect(screen.queryByText('New arrivals')).toBeNull();
    expect(screen.queryByRole('link', { name: 'View all' })).toBeNull();
  });

  it('skeleton has aria-busy', () => {
    renderShell(<ProductSectionSkeleton />);
    expect(screen.getByTestId('product-section-skeleton')).toHaveAttribute('aria-busy', 'true');
    expect(within(screen.getByTestId('product-section-skeleton')).getByRole('status')).toHaveTextContent('Loading products');
  });

  it('has no accessibility violations', async () => {
    stubFetch({ '/api/cart/count': () => ({ count: 0 }) });
    const { container } = renderShell(<ProductSection id="home-bestsellers" eyebrow="Most loved" title="Bestsellers" viewAllHref="/shop" products={four} />);
    await expectNoAxeViolations(container);
  });
});
