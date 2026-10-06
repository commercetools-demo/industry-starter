import { screen, within } from '@testing-library/react';
import { makeProduct } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import { EditorialPanel } from './EditorialPanel';
import { NewIn } from './NewIn';

const products = ['Bananas', 'Whole milk', 'Sourdough', 'Oat drink'].map((name, i) =>
  makeProduct({ id: `p-${i}`, name, slug: name.toLowerCase().replace(' ', '-') }),
);

describe('NewIn', () => {
  it('Product tile click: four tiles, each linking to its product page', () => {
    renderWithProviders(<NewIn products={products} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/en-US/p/whole-milk');
    expect(screen.getByRole('link', { name: 'See all →' })).toHaveAttribute('href', '/en-US/shop?sort=newest');
  });

  it('never shows more than four and has no heart on home tiles', () => {
    renderWithProviders(<NewIn products={[...products, makeProduct({ id: 'p-9', name: 'Extra' })]} />);
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses the 340 px photo', () => {
    const { container } = renderWithProviders(<NewIn products={products} />);
    expect(container.querySelector('.h-\\[340px\\]')).not.toBeNull();
    expect(container.querySelector('.h-\\[330px\\]')).toBeNull();
  });

  it('renders nothing without products', () => {
    const { container } = renderWithProviders(<NewIn products={[]} />);
    expect(container.querySelector('[data-section="new-in"]')).toBeNull();
  });
});

describe('EditorialPanel', () => {
  it('button goes to the journal; kicker and heading render', () => {
    renderWithProviders(<EditorialPanel />);
    expect(screen.getByRole('heading', { level: 2, name: 'A morning at the bakery' })).toBeInTheDocument();
    expect(screen.getByText('From the journal · No. 14')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the journal' })).toHaveAttribute('href', '/en-US/journal');
  });

  it('German copy and links', () => {
    renderWithProviders(<EditorialPanel />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Zum Journal' })).toHaveAttribute('href', '/de-DE/journal');
  });
});
