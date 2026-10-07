import { screen } from '@testing-library/react';
import { usd } from '@/lib/listing/__fixtures__/catalog';
import { renderWithProviders } from '@/test/utils';
import { HOME_TREE } from './__fixtures__/home';
import { PromoTiles } from './PromoTiles';

describe('PromoTiles', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the phone and add-ons tiles with derived copy and category links', () => {
    renderWithProviders(<PromoTiles locale="en-US" tree={HOME_TREE} phonePrice={usd(2500)} addonNames={['Spotify', 'Apple TV+', 'Netflix']} />);
    expect(screen.getByText('PHONE PLANS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plans from $25 a line' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop phone plans' })).toHaveAttribute('href', '/en-US/shop/phone-plans');
    expect(screen.getByRole('heading', { name: 'Spotify, Apple TV+ and more on your bill' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse add-ons' })).toHaveAttribute('href', '/en-US/shop/add-ons');
  });

  it('falls back to a title without a price', () => {
    renderWithProviders(<PromoTiles locale="en-US" tree={HOME_TREE} phonePrice={null} addonNames={[]} />);
    expect(screen.getByRole('heading', { name: 'Plans for every phone' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Streaming, music and extras on your bill' })).toBeInTheDocument();
  });

  it('Banner target does not resolve: banner omitted and omission logged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tree = HOME_TREE.filter((category) => category.key !== 'malva-cat-add-ons');
    renderWithProviders(<PromoTiles locale="en-US" tree={tree} phonePrice={usd(2500)} addonNames={['Spotify']} />);
    expect(screen.queryByRole('link', { name: 'Browse add-ons' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop phone plans' })).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[home] banner target does not resolve', { categoryKey: 'malva-cat-add-ons' });
  });
});
