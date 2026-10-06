import { screen, within } from '@testing-library/react';
import { CartLineRow } from '@/components/cart/CartLineRow';
import { cartLine, renderWithCart } from '@/test/cart';
import { makeProduct, makeVariant } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import { BuyBox } from './BuyBox';
import { ProductTile } from './ProductTile';

vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle: vi.fn() }) }));
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/p/bananas',
}));

const grams = makeVariant({
  sku: 'BANANAS-500G',
  price: { centAmount: 240, currencyCode: 'EUR' },
  increment: { value: 500, unit: 'g', label: '500 g' },
  approximateWeight: true,
});
const each = makeVariant({ sku: 'MILK-1', price: { centAmount: 199, currencyCode: 'EUR' }, increment: { value: 1, unit: 'each', label: '1 each' } });

describe('Unit price is shown by tile, PDP and cart line', () => {
  it('Tile: 500 g bananas show the per-kg price; an Each item shows none', () => {
    const { unmount } = renderWithProviders(<ProductTile product={makeProduct({ variants: [grams] })} />);
    expect(screen.getByTestId('unit-price')).toHaveTextContent('€4.80 / kg');
    unmount();
    renderWithProviders(<ProductTile product={makeProduct({ name: 'Milk', variants: [each] })} />);
    expect(screen.queryByTestId('unit-price')).not.toBeInTheDocument();
  });

  it('PDP BuyBox: the unit price sits with the price', () => {
    renderWithCart(<BuyBox product={makeProduct({ variants: [grams] })} variant={grams} selectors={[]} />);
    expect(screen.getByTestId('unit-price')).toHaveTextContent('€4.80 / kg');
  });

  it('PDP BuyBox: Each item has no unit line', () => {
    renderWithCart(<BuyBox product={makeProduct({ variants: [each] })} variant={each} selectors={[]} />);
    expect(screen.queryByTestId('unit-price')).not.toBeInTheDocument();
  });

  it('Cart line: increment label and unit price appear under the name', () => {
    const line = cartLine({
      name: 'Bananas',
      unitPrice: { centAmount: 240, currencyCode: 'EUR' },
      increment: { value: 500, unit: 'g', label: '500 g' },
    });
    renderWithCart(
      <ul>
        <CartLineRow line={line} displayQuantity={1} busy={false} onQuantityChange={vi.fn()} onRemove={vi.fn()} />
      </ul>,
      { locale: 'de-DE' },
    );
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('500 g')).toBeInTheDocument();
    expect(within(row).getByTestId('unit-price').textContent).toMatch(/^4,80\s€ \/ kg$/);
  });

  it('Cart line: Each item has no unit line', () => {
    const line = cartLine({ increment: { value: 1, unit: 'each', label: '1 each' } });
    renderWithCart(
      <ul>
        <CartLineRow line={line} displayQuantity={1} busy={false} onQuantityChange={vi.fn()} onRemove={vi.fn()} />
      </ul>,
    );
    expect(screen.queryByTestId('unit-price')).not.toBeInTheDocument();
  });
});
