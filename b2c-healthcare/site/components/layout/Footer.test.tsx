import { describe, expect, it, vi } from 'vitest';
import { FOOTER_COLUMNS } from '@/lib/nav';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen, within } from '@/test/utils';
import { setPathname } from '@/test/navigation-mock';

vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);

import { Footer } from './Footer';

const ALL_LIVE = FOOTER_COLUMNS.map((column) => ({ ...column, links: column.links.map((link) => ({ ...link, live: true })) }));

describe('design-storefront-shell › Footer', () => {
  it('App footer: copyright and the emergency disclaimer in a navy strip', () => {
    setPathname('/en-US/doctors/remote');
    renderWithProviders(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('bg-navy-700');
    expect(within(footer).getByText('© 2026 Malva Healthcare')).toBeInTheDocument();
    expect(within(footer).getByText('Not for emergencies — call your local emergency number.')).toBeInTheDocument();
    expect(within(footer).queryAllByRole('link')).toHaveLength(0);
    expect(within(footer).queryByRole('heading')).toBeNull();
  });

  it('Home footer: brand blurb, Care / Pharmacy / Company columns and the same legal line (all pages live)', () => {
    setPathname('/en-US');
    renderWithProviders(<Footer columns={ALL_LIVE} />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(messages.shell.footer.blurb)).toBeInTheDocument();
    expect(within(footer).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Care', 'Pharmacy', 'Company']);
    expect(within(footer).getByRole('link', { name: 'Video sessions' })).toHaveAttribute('href', '/en-US/doctors/remote');
    expect(within(footer).getByRole('link', { name: 'Order medicine' })).toHaveAttribute('href', '/en-US/prescriptions');
    expect(within(footer).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/en-US/about');
    expect(within(footer).getByText('© 2026 Malva Healthcare')).toBeInTheDocument();
    expect(within(footer).getByText('Not for emergencies — call your local emergency number.')).toBeInTheDocument();
  });

  it('Home footer: a link to a page that does not exist yet is omitted, and so is an empty column', () => {
    setPathname('/en-US');
    const pending = FOOTER_COLUMNS.map((column) => ({
      ...column,
      links: column.links.map((link) => ({ ...link, live: link.labelKey !== 'about' && link.labelKey !== 'contact' && column.headingKey !== 'company' })),
    }));
    renderWithProviders(<Footer columns={pending} />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Care', 'Pharmacy']);
    expect(within(footer).queryByRole('link', { name: 'About' })).toBeNull();
    expect(within(footer).queryByRole('link', { name: 'Contact' })).toBeNull();
    expect(within(footer).queryByRole('link', { name: /careers|delivery/i })).toBeNull();
  });

  it('Home footer (default manifest): the Company column links the content pages that now exist', () => {
    setPathname('/en-US');
    renderWithProviders(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Care', 'Pharmacy', 'Company']);
    for (const [name, href] of [
      ['About', '/en-US/about'],
      ['Contact', '/en-US/contact'],
      ['FAQ', '/en-US/faq'],
      ['Shipping and returns', '/en-US/policies/shipping-and-returns'],
      ['Terms and conditions', '/en-US/policies/terms'],
      ['Privacy policy', '/en-US/policies/privacy'],
    ] as const) {
      expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('an explicit variant overrides the route', () => {
    setPathname('/en-US/doctors/remote');
    renderWithProviders(<Footer variant="home" />);
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
  });
});
