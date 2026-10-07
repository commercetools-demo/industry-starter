import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ResultCount } from './ResultCount';
import { TitleStrip } from './TitleStrip';

describe('TitleStrip', () => {
  it('breadcrumb, H1 and blurb', () => {
    renderWithProviders(<TitleStrip breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Cable internet' }]} title="Cable internet" blurb="Fast cable." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cable internet' })).toBeInTheDocument();
    expect(screen.getByText('Fast cable.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en-US');
    expect(screen.getByText('Cable internet', { selector: '[aria-current="page"]' })).toBeInTheDocument();
  });

  it('links to the child categories', () => {
    renderWithProviders(<TitleStrip breadcrumb={[{ label: 'Add-ons' }]} title="Add-ons" subcategories={[{ key: 's', name: 'Streaming', href: '/shop/streaming-entertainment' }]} />);
    expect(screen.getByRole('navigation', { name: 'Browse by type' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Streaming' })).toHaveAttribute('href', '/en-US/shop/streaming-entertainment');
  });
});

describe('ResultCount', () => {
  it('uses the noun and pluralises', () => {
    const { unmount } = renderWithProviders(<ResultCount noun="plans" count={3} />);
    expect(screen.getByText('3 plans')).toHaveAttribute('role', 'status');
    unmount();
    renderWithProviders(<ResultCount noun="plans" count={1} />);
    expect(screen.getByText('1 plan')).toBeInTheDocument();
  });

  it('items and add-ons', () => {
    renderWithProviders(<ResultCount noun="items" count={5} />);
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });
});
