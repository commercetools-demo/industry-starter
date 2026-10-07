import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TREE } from '@/lib/listing/__fixtures__/catalog';
import { resolveFallbackTiles } from '@/lib/search/tiles';
import { NoResults } from './NoResults';
import { SearchError } from './SearchError';
import { SearchForm } from './SearchForm';
import { StartState } from './StartState';
import { UnsupportedLanguage } from './UnsupportedLanguage';

describe('search states', () => {
  afterEach(() => vi.restoreAllMocks());

  it('Query matches nothing: states the absence, keeps the query editable and offers the configured fallback tiles', () => {
    const tiles = resolveFallbackTiles(TREE, 'en-US');
    renderWithProviders(
      <>
        <SearchForm q="zzzzqq" />
        <NoResults query="zzzzqq" tiles={tiles} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'No results for “zzzzqq”' })).toBeInTheDocument();
    expect(screen.getByText(/Check the spelling/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('zzzzqq');
    const nav = screen.getByRole('navigation', { name: 'Browse categories' });
    expect(within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Phone plans', '/en-US/shop/phone-plans'],
      ['Wireless internet', '/en-US/shop/home-wireless-internet'],
      ['Cable internet', '/en-US/shop/cable-internet'],
      ['Add-ons', '/en-US/shop/add-ons'],
    ]);
  });

  it('a fallback key the tree does not know is omitted and warned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tiles = resolveFallbackTiles(TREE, 'en-US', ['malva-cat-cable-internet', 'malva-cat-gone']);
    expect(tiles.map((tile) => tile.key)).toEqual(['malva-cat-cable-internet']);
    expect(warn).toHaveBeenCalledWith('[search] fallback category missing', 'malva-cat-gone');
  });

  it('fallback tiles use the slugs of the locale', () => {
    expect(resolveFallbackTiles(TREE, 'de-DE')[2]).toMatchObject({ name: 'Cable internet', href: '/shop/kabel-internet' });
  });

  it('Unsupported language: shows the dedicated message', () => {
    renderWithProviders(<UnsupportedLanguage />);
    expect(screen.getByRole('heading', { name: 'Search is not available in this language' })).toBeInTheDocument();
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
  });

  it('the start state lists the curated popular searches as links to ?q= and the tiles', () => {
    renderWithProviders(<StartState hint={false} tiles={resolveFallbackTiles(TREE, 'en-US')} />);
    const popular = within(screen.getByRole('region', { name: 'Popular searches' }));
    expect(popular.getByRole('link', { name: 'Cable 500' })).toHaveAttribute('href', '/en-US/search?q=Cable%20500');
    expect(popular.getByRole('link', { name: 'Spotify' })).toHaveAttribute('href', '/en-US/search?q=Spotify');
    expect(screen.queryByText('Type at least 2 characters.')).not.toBeInTheDocument();
  });

  it('the start state asks for two characters when one was typed', () => {
    renderWithProviders(<StartState hint tiles={[]} />);
    expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument();
  });

  it('the error state offers a retry link that keeps the URL', () => {
    renderWithProviders(<SearchError retryHref="/search?q=cable&sort=price-asc" />);
    expect(screen.getByRole('heading', { name: 'Search is temporarily unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en-US/search?q=cable&sort=price-asc');
  });

  it('German copy', () => {
    renderWithProviders(<NoResults query="xx" tiles={[]} />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { name: 'Keine Ergebnisse für „xx“' })).toBeInTheDocument();
  });
});
