import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Pill } from './Pill';

describe('Pill', () => {
  it('renders a link with the locale prefix and the inactive look', () => {
    renderWithProviders(<Pill href="/shop/cable-internet">Cable</Pill>);
    const link = screen.getByRole('link', { name: 'Cable' });
    expect(link).toHaveAttribute('href', '/en-US/shop/cable-internet');
    expect(link).toHaveClass('text-text-on-brand', 'rounded-pill', 'tracking-ui');
    expect(link).not.toHaveClass('bg-brand-950');
  });

  it('active is the dark pill and passes aria-current through', () => {
    renderWithProviders(
      <Pill href="/bundle" active aria-current="page">
        Bundle
      </Pill>,
    );
    const link = screen.getByRole('link', { name: 'Bundle' });
    expect(link).toHaveClass('bg-brand-950', 'text-text-on-pink');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('as button renders a button with a focus ring', () => {
    renderWithProviders(<Pill as="button">Go</Pill>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('focus-visible:outline-2');
  });
});
