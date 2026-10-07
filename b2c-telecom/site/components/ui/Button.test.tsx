import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Button } from './Button';

describe('Button', () => {
  it('maps each variant to its token classes', () => {
    renderWithProviders(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="dark">Dark</Button>
        <Button variant="ghost">Ghost</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass('bg-action', 'text-text-on-pink', 'rounded-pill', 'min-h-11');
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border-action', 'text-action');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveClass('bg-brand-950');
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass('text-text-link');
  });

  it('size sm is 36 px tall at least', () => {
    renderWithProviders(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('min-h-9');
  });

  it('href renders a locale-aware link with the same classes', () => {
    renderWithProviders(<Button href="/bundle">Open</Button>);
    const link = screen.getByRole('link', { name: 'Open' });
    expect(link).toHaveAttribute('href', '/en-US/bundle');
    expect(link).toHaveClass('rounded-pill', 'bg-action');
  });

  it('disabled sets the attribute and swallows clicks', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Off' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('pressed sets aria-pressed and the filled look on a secondary button', () => {
    renderWithProviders(
      <Button variant="secondary" pressed>
        Selected
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Selected' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('bg-action');
  });

  it('loading sets aria-busy, disables the button and shows a spinner', () => {
    const { container } = renderWithProviders(<Button loading>Saving</Button>);
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('every variant carries a visible focus ring', () => {
    renderWithProviders(
      <>
        <Button>A</Button>
        <Button variant="dark">B</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'A' })).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-offset-2');
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-brand-950');
  });
});
