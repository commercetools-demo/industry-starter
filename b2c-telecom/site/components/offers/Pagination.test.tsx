import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Pagination, pageNumbers } from './Pagination';

describe('pageNumbers', () => {
  it('lists every page up to seven', () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the rest into gaps with the current page in a window', () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageNumbers(12, 12)).toEqual([1, null, 11, 12]);
    expect(pageNumbers(2, 12)).toEqual([1, 2, 3, null, 12]);
  });
});

describe('Pagination', () => {
  it('renders nothing for one page', () => {
    renderWithProviders(<Pagination page={1} pageCount={1} basePath="/shop/add-ons" />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('three pages: numbers, the current one marked, no Previous on page 1', () => {
    renderWithProviders(<Pagination page={1} pageCount={3} basePath="/shop/add-ons" />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).queryByRole('link', { name: 'Previous' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/en-US/shop/add-ons?page=2');
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/en-US/shop/add-ons');
    expect(within(nav).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en-US/shop/add-ons?page=2');
  });

  it('the last page has Previous and no Next', () => {
    renderWithProviders(<Pagination page={2} pageCount={2} basePath="/shop/add-ons" />);
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/shop/add-ons');
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
  });

  it('twelve pages show an ellipsis', () => {
    renderWithProviders(<Pagination page={6} pageCount={12} basePath="/shop/add-ons" />);
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Page 12' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Page 3' })).toBeNull();
  });

  it('keeps the other parameters on every link', () => {
    renderWithProviders(<Pagination page={1} pageCount={3} basePath="/shop/add-ons" query={{ filter: 'video', sort: 'price-desc' }} />);
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '/en-US/shop/add-ons?filter=video&sort=price-desc&page=3');
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/en-US/shop/add-ons?filter=video&sort=price-desc');
  });

  it('is labelled in German', () => {
    renderWithProviders(<Pagination page={2} pageCount={3} basePath="/shop/zusatzoptionen" />, { locale: 'de-DE' });
    expect(screen.getByRole('navigation', { name: 'Seitennavigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zurück' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Weiter' })).toBeInTheDocument();
  });
});
