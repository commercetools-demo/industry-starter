import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PolicyLink from '@/components/content/PolicyLink';
import { BUILT_ROUTES, footerHref } from '@/lib/nav/footer-config';
import { POLICY_SLUGS } from '@/lib/routes';
import { renderWithIntl } from '@/test/render';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import Footer from '@/components/layout/Footer';

afterEach(() => vi.unstubAllGlobals());

describe('Wiring', () => {
  it('footer links point at content routes', () => {
    stubFetch({});
    renderShell(<Footer categories={[]} />);
    const help = within(screen.getByRole('navigation', { name: 'Help' }));
    expect(help.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    expect(help.getByRole('link', { name: 'Questions and answers' })).toHaveAttribute('href', '/faq');
    expect(help.getByRole('link', { name: 'Shipping and returns' })).toHaveAttribute('href', '/policies/shipping-returns');
    const company = within(screen.getByRole('navigation', { name: 'Company' }));
    expect(company.getByRole('link', { name: 'About Malva' })).toHaveAttribute('href', '/about');
    expect(company.getByRole('link', { name: 'Journal' })).toHaveAttribute('href', '/journal');
    const legal = within(screen.getByRole('contentinfo'));
    expect(legal.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/policies/privacy');
    expect(legal.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/policies/terms');
    expect(legal.getByRole('link', { name: 'Accessibility' })).toHaveAttribute('href', '/policies/accessibility');
    expect(within(screen.getByRole('navigation', { name: 'Collect' })).getByRole('link', { name: 'How collection works' })).toHaveAttribute(
      'href',
      '/faq?q=collecting-how',
    );
  });

  it('account tab links are built routes (workstream L); an unbuilt account path still goes home', () => {
    expect(BUILT_ROUTES.has('/account/orders')).toBe(true);
    expect(footerHref('/account/orders')).toBe('/account/orders');
    expect(footerHref('/account/does-not-exist')).toBe('/');
    expect(footerHref('/faq?q=anything')).toBe('/faq?q=anything');
  });

  it('every policy slug is a built route', () => {
    for (const slug of POLICY_SLUGS) expect(BUILT_ROUTES.has(`/policies/${slug}`)).toBe(true);
  });

  it('policy links open in a new tab and keep the original page', () => {
    renderWithIntl(<PolicyLink slug="terms">Terms of sale</PolicyLink>);
    const link = screen.getByRole('link', { name: 'Terms of sale' });
    expect(link).toHaveAttribute('href', '/policies/terms');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
