import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { FooterLegalLinks } from './FooterLegalLinks';

describe('FooterLegalLinks', () => {
  it('renders seven locale-aware links in en-US', () => {
    renderWithProviders(<FooterLegalLinks />);
    const nav = screen.getByRole('navigation', { name: 'Company and legal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['About us', '/en-US/about'],
      ['FAQ', '/en-US/faq'],
      ['Blog', '/en-US/blog'],
      ['Shipping and returns', '/en-US/legal/shipping-returns'],
      ['Terms', '/en-US/legal/terms'],
      ['Privacy', '/en-US/legal/privacy'],
    ]);
  });

  it('uses German labels and hrefs in de-DE', () => {
    renderWithProviders(<FooterLegalLinks />, { locale: 'de-DE' });
    const nav = screen.getByRole('navigation', { name: 'Unternehmen und Rechtliches' });
    expect(within(nav).getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/de-DE/legal/privacy');
    expect(within(nav).getByRole('link', { name: 'Über uns' })).toHaveAttribute('href', '/de-DE/about');
  });

  it('is part of the site footer next to the existing navigation', () => {
    renderWithProviders(<SiteFooter items={[]} />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('navigation', { name: 'Footer' })).toBeInTheDocument();
    expect(within(footer).getByRole('navigation', { name: 'Company and legal' })).toBeInTheDocument();
  });
});
