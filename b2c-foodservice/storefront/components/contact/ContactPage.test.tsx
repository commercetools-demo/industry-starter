import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CONTACT } from '@/content/contact';
import { renderWithIntl } from '@/test/render';
import ContactView from './ContactView';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());
vi.mock('@/hooks/useAccount', () => ({ useAccount: () => ({ customer: null, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/components/layout/FooterStoreButton', () => ({
  default: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

describe('Contact page', () => {
  it('Chat script absent: no chat placeholder and no third-party script', () => {
    const { container } = renderWithIntl(<ContactView locale="en-US" />);
    expect(container.querySelector('[data-chat]')).toBeNull();
    const external = [...container.querySelectorAll('script[src]')].filter((s) => !(s.getAttribute('src') ?? '').startsWith('/'));
    expect(external).toHaveLength(0);
  });

  it('Region without an office: default channels are shown', () => {
    const onlyDefault = { default: CONTACT.default, byCountry: {} };
    renderWithIntl(<ContactView locale="en-CA" contact={onlyDefault} />, { locale: 'en-CA' });
    expect(screen.getByRole('link', { name: CONTACT.default.email })).toHaveAttribute('href', `mailto:${CONTACT.default.email}`);
    expect(screen.getByText(CONTACT.default.hours['en-US'])).toBeInTheDocument();
  });

  it('shows the Canada channels in Canada and no store block', () => {
    renderWithIntl(<ContactView locale="en-CA" />, { locale: 'en-CA' });
    expect(screen.getByRole('link', { name: CONTACT.byCountry.CA!.email })).toBeInTheDocument();
    expect(screen.queryByText('Looking for a store?')).toBeNull();
  });

  it('shows the US channels and the store block in the US', () => {
    renderWithIntl(<ContactView locale="en-US" />);
    expect(screen.getByRole('link', { name: CONTACT.byCountry.US!.email })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find your store' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: CONTACT.byCountry.US!.phone! })).toHaveAttribute('href', 'tel:+12125550100');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
