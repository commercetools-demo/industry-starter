import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Hero } from './Hero';

describe('Hero', () => {
  it('Editorial hero default: H1, tag and two buttons with the right hrefs', () => {
    const { container } = renderWithProviders(<Hero layout="editorial" imageUrl="https://picsum.photos/seed/x/10/10" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Good food, quietly sourced' })).toBeInTheDocument();
    expect(screen.getByText('Autumn 26 · Fresh from the farm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop the collection' })).toHaveAttribute('href', '/en-US/shop');
    expect(screen.getByRole('link', { name: 'Read the story' })).toHaveAttribute('href', '/en-US/journal');
    expect(screen.getByAltText('A wooden table with seasonal vegetables and fresh bread')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-hero]')).toHaveLength(1);
    expect(container.querySelector('[data-hero="editorial"]')).not.toBeNull();
  });

  it('Editorial hero: an empty image URL renders the placeholder block, not a broken image', () => {
    renderWithProviders(<Hero layout="editorial" imageUrl="" />);
    expect(screen.getByRole('img', { name: /wooden table/i })).toHaveAttribute('data-placeholder', 'true');
  });

  it('Magazine grid: five tiles, A spans 2x2, E spans two columns, links go to journal and shop', () => {
    const { container } = renderWithProviders(<Hero layout="grid" imageUrl="" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Aisle by aisle' })).toBeInTheDocument();
    const tiles = container.querySelectorAll('[data-tile]');
    expect(tiles).toHaveLength(5);
    const tile = (k: string) => container.querySelector(`[data-tile="${k}"]`) as HTMLElement;
    expect(tile('a').className).toContain('tablet:col-span-2');
    expect(tile('a').className).toContain('tablet:row-span-2');
    expect(tile('e').className).toContain('tablet:col-span-2');
    for (const k of ['b', 'c', 'd']) expect(tile(k).className).not.toContain('span');
    expect(within(tile('a')).getByRole('link')).toHaveAttribute('href', '/en-US/journal');
    expect(within(tile('e')).getByRole('link')).toHaveAttribute('href', '/en-US/journal');
    for (const k of ['b', 'c', 'd']) expect(within(tile(k)).getByRole('link')).toHaveAttribute('href', '/en-US/shop');
  });

  it('Variant switch: exactly one hero renders and the other is absent', () => {
    const grid = renderWithProviders(<Hero layout="grid" imageUrl="" />);
    expect(grid.container.querySelectorAll('[data-hero]')).toHaveLength(1);
    expect(grid.container.querySelector('[data-hero="editorial"]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Shop the collection' })).toBeNull();
  });

  it('German copy renders in de-DE', () => {
    renderWithProviders(<Hero layout="editorial" imageUrl="" />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Zur Kollektion' })).toHaveAttribute('href', '/de-DE/shop');
  });
});
