import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Breadcrumb } from './Breadcrumb';

const ITEMS = [{ label: 'Home', href: '/' }, { label: 'Phone plans', href: '/shop/phone-plans' }, { label: 'Unlimited' }];

describe('Breadcrumb', () => {
  it('the last item is not a link and has aria-current page', () => {
    renderWithProviders(<Breadcrumb items={ITEMS} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/en-US', '/en-US/shop/phone-plans']);
    const last = within(nav).getByText('Unlimited');
    expect(last).toHaveAttribute('aria-current', 'page');
    expect(last.closest('a')).toBeNull();
  });

  it('the nav label is translated', () => {
    renderWithProviders(<Breadcrumb items={ITEMS} />, { locale: 'de-DE' });
    expect(screen.getByRole('navigation', { name: 'Brotkrumenpfad' })).toBeInTheDocument();
  });

  it('uses brand-900, not brand-800, for the text', () => {
    renderWithProviders(<Breadcrumb items={ITEMS} />);
    expect(screen.getByRole('list')).toHaveClass('text-brand-900');
    expect(screen.getByRole('list')).not.toHaveClass('text-brand-800');
  });
});
