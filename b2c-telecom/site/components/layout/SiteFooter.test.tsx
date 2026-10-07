import { screen, within } from '@testing-library/react';
import { buildNavItems } from '@/lib/nav';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { SiteFooter } from './SiteFooter';

const ROOTS: [string, string, string, string][] = [
  ['phone-plans', 'handytarife', 'Phone plans', 'Handytarife'],
  ['home-wireless-internet', 'funk-internet', 'Wireless internet', 'Funk-Internet'],
  ['cable-internet', 'kabel-internet', 'Cable internet', 'Kabel-Internet'],
  ['add-ons', 'zusatzangebote', 'Add-ons', 'Zusatzangebote'],
];

function tree(locale: 'en-US' | 'de-DE'): Category[] {
  return ROOTS.map(([en, de, nameEn, nameDe]) => ({
    id: en,
    key: `malva-cat-${en}`,
    name: locale === 'en-US' ? nameEn : nameDe,
    slug: locale === 'en-US' ? en : de,
    slugs: { 'en-US': en, 'de-DE': de },
    children: [],
  }));
}

describe('SiteFooter', () => {
  it('Footer links: every item is a link with the category href and Support goes to /support', () => {
    renderWithProviders(<SiteFooter items={buildNavItems(tree('en-US'), 'en-US')} />);
    const nav = screen.getByRole('navigation', { name: 'Footer' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Phone plans', 'Wireless internet', 'Cable internet', 'Add-ons', 'Support']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/en-US/shop/phone-plans',
      '/en-US/shop/home-wireless-internet',
      '/en-US/shop/cable-internet',
      '/en-US/shop/add-ons',
      '/en-US/support',
    ]);
  });

  it('is the contentinfo landmark on the dark surface with the copyright', () => {
    renderWithProviders(<SiteFooter items={[]} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('data-surface', 'dark');
    expect(footer).toHaveClass('bg-brand-950');
    expect(footer).toHaveTextContent('© 2026 Malva Telecom');
  });

  it('links the image credit to Pexels (D-055)', () => {
    renderWithProviders(<SiteFooter items={[]} />);
    expect(screen.getByRole('link', { name: 'Photos from Pexels' })).toHaveAttribute('href', 'https://www.pexels.com');
  });

  it('renders the credits slot', () => {
    renderWithProviders(<SiteFooter items={[]} credits={<span>Photos by Ada</span>} />);
    expect(screen.getByText('Photos by Ada')).toBeInTheDocument();
  });

  it('with no items (catalog unavailable) Support and the copyright remain', () => {
    renderWithProviders(<SiteFooter items={[]} />);
    expect(within(screen.getByRole('navigation', { name: 'Footer' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Support']);
  });

  it('de-DE labels and hrefs', () => {
    renderWithProviders(<SiteFooter items={buildNavItems(tree('de-DE'), 'de-DE')} />, { locale: 'de-DE' });
    const nav = screen.getByRole('navigation', { name: 'Fußzeile' });
    expect(within(nav).getByRole('link', { name: 'Kabel-Internet' })).toHaveAttribute('href', '/de-DE/shop/kabel-internet');
    expect(within(nav).getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/de-DE/support');
  });
});
