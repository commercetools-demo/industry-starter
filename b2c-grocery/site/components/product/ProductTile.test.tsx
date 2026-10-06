import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { makeProduct, makeVariant } from '@/test/product';
import { PriceBlock } from './PriceBlock';
import { ProductTile } from './ProductTile';

const toggle = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle }) }));

beforeEach(() => toggle.mockClear());

describe('ProductTile', () => {
  it('shows image, name and price on one row, brand, and links to the product', () => {
    renderWithProviders(<ProductTile product={makeProduct()} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/en-US/p/bananas');
    expect(within(link).getByRole('heading', { name: 'Bananas' })).toBeInTheDocument();
    expect(within(link).getByText('$2.49')).toBeInTheDocument();
    expect(within(link).getByText('Finca Verde')).toBeInTheDocument();
    expect(link.querySelector('img')).not.toBeNull();
    expect(screen.queryByText('Out of stock')).not.toBeInTheDocument();
  });

  it('Out of stock: the default variant not in stock gets the tag', () => {
    const product = makeProduct({ variants: [makeVariant({ availability: { isOnStock: false, availableQuantity: 0 } })] });
    renderWithProviders(<ProductTile product={product} />);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('German locale: euro price and German links', () => {
    const product = makeProduct({ variants: [makeVariant({ price: { centAmount: 296, currencyCode: 'EUR' } })] });
    renderWithProviders(<ProductTile product={product} />, { locale: 'de-DE' });
    expect(screen.getByText(/2,96\s€/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/de-DE/p/bananas');
  });

  it('Save from the grid: the heart toggles and the click does not navigate', () => {
    renderWithProviders(<ProductTile product={makeProduct()} />);
    const heart = screen.getByRole('button', { name: /save bananas/i });
    const notPrevented = fireEvent.click(heart);
    expect(toggle).toHaveBeenCalledWith('p-1');
    expect(notPrevented).toBe(false); // preventDefault was called
    expect(heart.closest('a')).toBeNull();
  });

  it('click on the heart does not bubble to the tile', () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <div onClick={onClick}>
        <ProductTile product={makeProduct()} />
      </div>,
    );
    fireEvent.click(container.querySelector('button') as HTMLElement);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('PriceBlock', () => {
  it('plain price', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 1250, currencyCode: 'USD' }} />);
    expect(screen.getByText('$12.50')).toBeInTheDocument();
    expect(document.querySelector('del')).toBeNull();
  });

  it('Discount: the discounted price is current and the original is struck through', () => {
    renderWithProviders(<PriceBlock price={{ centAmount: 500, currencyCode: 'USD', discounted: { centAmount: 399, currencyCode: 'USD' } }} />);
    const del = document.querySelector('del') as HTMLElement;
    expect(del).toHaveTextContent('$5.00');
    expect(screen.getByText('$3.99', { selector: '[aria-hidden]' })).toBeInTheDocument();
    expect(screen.getByText('Now $3.99')).toBeInTheDocument();
  });

  it('missing price renders nothing', () => {
    renderWithProviders(<PriceBlock />);
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });
});
