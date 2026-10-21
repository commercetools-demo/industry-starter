import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import type { Store } from '@/lib/types';
import { nav, renderShell, stubFetch } from '@/test/shell';
import { useCollectionStore } from '@/hooks/useCollectionStore';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import ActiveFilters from '@/components/listing/ActiveFilters';
import AvailabilityChip from '@/components/listing/AvailabilityChip';
import Breadcrumbs from '@/components/listing/Breadcrumbs';
import ResultHeader from '@/components/listing/ResultHeader';
import SearchInput from '@/components/listing/SearchInput';
import SortSelect from '@/components/listing/SortSelect';

const store: Store = {
  id: 's1', key: 'mcf-store-nyc-soho', name: 'Malva SoHo', addressLine: '1 Main St', city: 'New York', postalCode: '10001',
  country: 'US', hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15,
};
const fb = (selectedKey: string | null, country = 'US') => ({
  [unstable_serialize(keyChannels(country))]: { stores: country === 'US' ? [store] : [], selectedKey },
});

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
  stubFetch({ '/api/channels': () => ({ stores: [store], selectedKey: null }), '/api/cart/count': () => ({ count: 0 }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('Breadcrumbs and header', () => {
  it('breadcrumb current page', () => {
    renderShell(<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Pods', href: '/category/pods' }, { label: 'Original' }]} />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Original')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Pods').closest('a')).not.toBeNull();
  });
  it('title for search', () => {
    renderShell(<ResultHeader scope="search" query="ember" total={3} crumbs={[{ label: 'Home', href: '/' }, { label: 'Search' }]} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for "ember"');
  });
  it('title for a category and for all products', () => {
    const { unmount } = renderShell(<ResultHeader scope="category" categoryName="Pods" total={12} crumbs={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pods');
    unmount();
    renderShell(<ResultHeader scope="shop" total={39} crumbs={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('All products');
  });
  it('count line plural', () => {
    const { unmount } = renderShell(<ResultHeader scope="shop" total={1} crumbs={[]} />);
    expect(screen.getByText('1 product')).toBeInTheDocument();
    unmount();
    renderShell(<ResultHeader scope="shop" total={39} crumbs={[]} />);
    expect(screen.getByText('39 products')).toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('search pill focused with clear button', async () => {
    renderShell(<SearchInput initialQuery="" otherParams="" autoFocus />);
    const input = screen.getByRole('searchbox', { name: 'Search products' });
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await userEvent.type(input, 'ember{Enter}');
    expect(nav.replace).toHaveBeenCalledWith('/search?q=ember');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(nav.replace).toHaveBeenLastCalledWith('/search');
  });
  it('submit keeps other params and drops the page', async () => {
    renderShell(<SearchInput initialQuery="old" otherParams="f_roast=dark&sort=rating" autoFocus={false} />);
    const input = screen.getByRole('searchbox');
    expect(input).not.toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'new{Enter}');
    expect(nav.replace).toHaveBeenCalledWith('/search?f_roast=dark&sort=rating&q=new');
  });
});

describe('SortSelect', () => {
  it('sort options and URL', async () => {
    const options = [
      { value: 'featured', label: 'Featured', href: '/shop' },
      { value: 'price-asc', label: 'Price: low to high', href: '/shop?sort=price-asc' },
      { value: 'price-desc', label: 'Price: high to low', href: '/shop?sort=price-desc' },
      { value: 'rating', label: 'Top rated', href: '/shop?sort=rating' },
    ];
    renderShell(<SortSelect value="featured" options={options} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(options.map((o) => o.label));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'price-asc');
    expect(nav.push).toHaveBeenCalledWith('/shop?sort=price-asc');
  });
});

describe('AvailabilityChip', () => {
  function Probe() {
    return <output data-testid="picker">{String(useCollectionStore().isOpen)}</output>;
  }
  it('Collect filter chip toggles avail and opens picker without a store', async () => {
    renderShell(<><AvailabilityChip active={false} href="/shop?avail=1" /><Probe /></>, { fallback: fb(null) });
    await userEvent.click(screen.getByRole('button', { name: /Available at my store/ }));
    expect(screen.getByTestId('picker')).toHaveTextContent('true');
    expect(nav.push).not.toHaveBeenCalled();
  });
  it('with a store the chip names it and navigates', async () => {
    stubFetch({ '/api/channels': () => ({ stores: [store], selectedKey: store.key }) });
    renderShell(<AvailabilityChip active href="/shop" />, { fallback: fb(store.key) });
    const chip = screen.getByRole('button', { name: /Available at Malva SoHo/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(nav.push).toHaveBeenCalledWith('/shop');
  });
  it('Canada listing has no availability controls', () => {
    renderShell(<AvailabilityChip active={false} href="/shop?avail=1" />, { locale: 'en-CA', fallback: fb(null, 'CA') });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ActiveFilters', () => {
  const chips = [
    { key: 'roast:dark', label: 'Dark', href: '/shop?f_decaf=true' },
    { key: 'decaf:true', label: 'Decaf', href: '/shop?f_roast=dark' },
  ];
  it('Remove a chip clears one filter and keeps the rest and does not scroll', () => {
    renderShell(<ActiveFilters chips={chips} clearAllHref="/shop" />);
    const remove = screen.getByRole('link', { name: 'Remove filter Dark' });
    expect(remove).toHaveAttribute('href', '/shop?f_decaf=true');
    expect(screen.getByRole('link', { name: 'Remove filter Decaf' })).toHaveAttribute('href', '/shop?f_roast=dark');
  });
  it('Clear all keeps q and path', () => {
    renderShell(<ActiveFilters chips={chips} clearAllHref="/search?q=ember" />);
    expect(screen.getByRole('link', { name: 'Clear all' })).toHaveAttribute('href', '/search?q=ember');
  });
  it('renders nothing without chips', () => {
    renderShell(<ActiveFilters chips={[]} clearAllHref="/shop" />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
