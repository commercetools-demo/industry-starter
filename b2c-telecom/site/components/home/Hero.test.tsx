import { screen } from '@testing-library/react';
import type { HeroFacts } from '@/lib/home/derive';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { HERO_ALT, HOME_TREE } from './__fixtures__/home';
import { Hero } from './Hero';

const facts: HeroFacts = { speed: { value: 1, unit: 'gbps' }, months: 24, price: { centAmount: 3999, currencyCode: 'USD' } };
const noImage = (tree: Category[]): Category[] => tree.map((category) => ({ ...category, image: undefined, imageAlt: undefined }));

describe('Hero', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the sub text uses the derived values', () => {
    renderWithProviders(<Hero locale="en-US" tree={HOME_TREE} facts={facts} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Fast fiber cable. Zero surprises.' })).toBeInTheDocument();
    expect(screen.getByText('Up to 1 Gbps at home from $39.99/mo, with price locked for 24 months.')).toBeInTheDocument();
  });

  it('month-to-month uses the sentence without a lock', () => {
    renderWithProviders(<Hero locale="en-US" tree={HOME_TREE} facts={{ ...facts, months: 0 }} />);
    expect(screen.getByText('Up to 1 Gbps at home from $39.99/mo.')).toBeInTheDocument();
  });

  it('de-DE formats the speed and the price for the locale', () => {
    renderWithProviders(<Hero locale="de-DE" tree={HOME_TREE} facts={{ ...facts, price: { centAmount: 3999, currencyCode: 'EUR' } }} />, { locale: 'de-DE' });
    expect(screen.getByText(/Bis zu 1 Gbit\/s zu Hause ab 39,99\s€\/Monat, mit 24 Monaten Preisgarantie\./)).toBeInTheDocument();
  });

  it('the CTA links to the cable category', () => {
    renderWithProviders(<Hero locale="en-US" tree={HOME_TREE} facts={facts} />);
    expect(screen.getByRole('link', { name: 'See cable plans' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
  });

  it('the image alt names the photographer', () => {
    renderWithProviders(<Hero locale="en-US" tree={HOME_TREE} facts={facts} />);
    expect(screen.getByRole('img', { name: HERO_ALT })).toBeInTheDocument();
  });

  it('no image shows the placeholder with its label', () => {
    renderWithProviders(<Hero locale="en-US" tree={noImage(HOME_TREE)} facts={facts} />);
    expect(screen.getByRole('img', { name: 'Hero image placeholder' })).toBeInTheDocument();
  });

  it('an image on a host that is not allowed shows the placeholder', () => {
    const tree = HOME_TREE.map((category) => (category.image ? { ...category, image: 'https://evil.example.com/a.jpg' } : category));
    renderWithProviders(<Hero locale="en-US" tree={tree} facts={facts} />);
    expect(screen.getByRole('img', { name: 'Hero image placeholder' })).toBeInTheDocument();
  });

  it('without a resolvable target the CTA is omitted', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderWithProviders(<Hero locale="en-US" tree={HOME_TREE.filter((category) => category.key !== 'malva-cat-cable-internet')} facts={facts} />);
    expect(screen.queryByRole('link', { name: 'See cable plans' })).not.toBeInTheDocument();
  });
});
