import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import Button, { buttonClasses } from './Button';
import ButtonLink from './ButtonLink';

describe('Button', () => {
  it('Button defaults to ink and type button', () => {
    render(<Button>Go</Button>);
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b).toHaveAttribute('type', 'button');
    expect(b.className).toContain('bg-ink');
    expect(b.className).toContain('rounded-pill');
  });

  it('Button accent and ghost classes differ', () => {
    expect(buttonClasses({ variant: 'accent' })).toContain('bg-accent');
    expect(buttonClasses({ variant: 'ghost' })).toContain('border-line-2');
    expect(buttonClasses({ variant: 'accent' })).not.toEqual(buttonClasses({ variant: 'ghost' }));
    expect(buttonClasses({ size: 'lg' })).toContain('text-[15px]');
    expect(buttonClasses({ block: true })).toContain('w-full');
  });

  it('Button press scales to 0.985', () => {
    expect(buttonClasses()).toContain('active:scale-[0.985]');
  });

  it('Button disabled has opacity 40 and blocks clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b).toBeDisabled();
    expect(b.className).toContain('disabled:opacity-40');
    expect(b.className).toContain('disabled:pointer-events-none');
    await userEvent.click(b).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Button loading disables and exposes aria-busy', () => {
    render(<Button loading>Go</Button>);
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
  });

  it('Button calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ButtonLink', () => {
  it('ButtonLink renders an anchor with the locale prefix', () => {
    renderWithIntl(<ButtonLink href="/cart">Bag</ButtonLink>, { locale: 'en-CA' });
    const a = screen.getByRole('link', { name: 'Bag' });
    expect(a.tagName).toBe('A');
    expect(a).toHaveAttribute('href', '/en-CA/cart');
    expect(a.className).toContain('rounded-pill');
  });
});
