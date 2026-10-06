import { screen } from '@testing-library/react';
import { makeProduct } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import { RelatedProducts } from './RelatedProducts';
import { Reviews } from './Reviews';

const many = (n: number) => Array.from({ length: n }, (_, i) => makeProduct({ id: `p-${i}`, name: `Product ${i}`, slug: `product-${i}` }));

describe('RelatedProducts', () => {
  it('excludes the current product and shows at most four, under "Pairs with"', () => {
    renderWithProviders(<RelatedProducts products={many(6)} currentId="p-0" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Pairs with' })).toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Product 1', 'Product 2', 'Product 3', 'Product 4']);
  });

  it('links to the other product pages', () => {
    renderWithProviders(<RelatedProducts products={many(2)} currentId="p-0" />);
    expect(screen.getByRole('link', { name: /Product 1/ }).getAttribute('href')).toMatch(/\/p\/product-1$/);
  });

  it('only the current product: renders nothing (no heading)', () => {
    const { container } = renderWithProviders(<RelatedProducts products={many(1)} currentId="p-0" />);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('Reviews', () => {
  it('No reviews (omitted): returns nothing, no heading and no gap', () => {
    const { container } = renderWithProviders(<Reviews product={makeProduct()} />);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('with review data: shows average, count, distribution and cards', () => {
    const product = makeProduct({
      reviews: {
        average: 4.8,
        count: 36,
        distribution: [0, 0, 1, 5, 30],
        items: [{ id: 'r1', author: 'Ana Maria', rating: 5, meta: 'Verified buyer', title: 'Sweet', body: 'Ripe and tasty.' }],
      },
    });
    renderWithProviders(<Reviews product={product} />);
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('36 reviews')).toBeInTheDocument();
    expect(screen.getByText('5 stars')).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sweet' })).toBeInTheDocument();
  });
});
