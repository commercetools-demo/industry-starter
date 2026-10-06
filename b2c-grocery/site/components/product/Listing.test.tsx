import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { makeProduct } from '@/test/product';
import { Breadcrumbs } from './Breadcrumbs';
import { ListingEmpty } from './ListingEmpty';
import { Pagination, pageItems } from './Pagination';
import { ProductGrid } from './ProductGrid';

vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle: async () => {} }) }));

describe('pageItems', () => {
  it('1 page: just 1', () => expect(pageItems(1, 1)).toEqual([1]));
  it('3 pages: all numbers', () => expect(pageItems(2, 3)).toEqual([1, 2, 3]));
  it('12 pages near the start: ellipsis before the last page', () => expect(pageItems(1, 12)).toEqual([1, 2, null, 12]));
  it('12 pages in the middle: both ellipses', () => expect(pageItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]));
  it('12 pages near the end', () => expect(pageItems(12, 12)).toEqual([1, null, 11, 12]));
  it('12 pages at page 3: no ellipsis next to page 1', () => expect(pageItems(3, 12)).toEqual([1, 2, 3, 4, null, 12]));
});

describe('Pagination', () => {
  it('a single page renders nothing', () => {
    renderWithProviders(<Pagination basePath="/shop" params={{}} page={1} pageCount={1} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('3 pages: current page is marked and the first page has no Previous link', () => {
    renderWithProviders(<Pagination basePath="/shop" params={{}} page={1} pageCount={3} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Page 2' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en-US/shop?page=2');
  });

  it('page 1 link has no page parameter and other params are preserved', () => {
    renderWithProviders(<Pagination basePath="/search" params={{ q: 'milk', sort: undefined }} page={2} pageCount={3} />);
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/en-US/search?q=milk');
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/search?q=milk');
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '/en-US/search?q=milk&page=3');
  });

  it('12 pages: ellipsis, and the last page has no Next link', () => {
    renderWithProviders(<Pagination basePath="/shop" params={{ category: 'bakery' }} page={12} pageCount={12} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveTextContent('…');
    expect(within(nav).queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Page 12' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/shop?category=bakery&page=11');
  });

  it('German labels', () => {
    renderWithProviders(<Pagination basePath="/shop" params={{}} page={2} pageCount={3} />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Zurück' })).toHaveAttribute('href', '/de-DE/shop');
    expect(screen.getByRole('link', { name: 'Weiter' })).toBeInTheDocument();
  });
});

describe('Breadcrumbs', () => {
  it('Shop only: Shop is the current page, not a link', () => {
    renderWithProviders(<Breadcrumbs />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US');
    expect(within(nav).queryByRole('link', { name: 'Shop' })).not.toBeInTheDocument();
    expect(within(nav).getByText('Shop')).toHaveAttribute('aria-current', 'page');
  });

  it('With a category: Shop links back and the category is current', () => {
    renderWithProviders(<Breadcrumbs category="Bakery" />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/en-US/shop');
    expect(within(nav).queryByRole('link', { name: 'Bakery' })).not.toBeInTheDocument();
    expect(within(nav).getByText('Bakery')).toHaveAttribute('aria-current', 'page');
  });
});

describe('ListingEmpty', () => {
  it('No results: heading, Clear filters and Contact us', () => {
    renderWithProviders(<ListingEmpty />);
    expect(screen.getByRole('heading', { name: 'Nothing under those terms' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en-US/contact');
  });
});

describe('ProductGrid', () => {
  it('renders one tile per product in a three-column desktop grid', () => {
    renderWithProviders(<ProductGrid products={[makeProduct({ id: 'a', name: 'Apples', slug: 'apples' }), makeProduct({ id: 'b', name: 'Pears', slug: 'pears' })]} />);
    const list = screen.getByRole('list');
    expect(list.className).toContain('desktop:grid-cols-3');
    expect(within(list).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Apples', 'Pears']);
  });
});
