import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/utils';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button, ButtonLink } from './Button';
import { Card } from './Card';
import { PageHead } from './PageHead';
import { statusVariant, type StatusKind } from './status';

describe('Button', () => {
  it('primary: azure fill with the action label tokens (never white), hover label token', () => {
    renderWithProviders(<Button>Book</Button>);
    const button = screen.getByRole('button', { name: 'Book' });
    expect(button).toHaveClass('bg-action', 'text-action-label', 'hover:text-action-label-hover', 'hover:bg-action-hover');
    expect(button.className).not.toMatch(/text-white|#fff/);
    expect(button).toHaveAttribute('type', 'button');
  });

  it('outline and small variants; 8 px radius for buttons, 4 px for small', () => {
    renderWithProviders(
      <>
        <Button variant="outline">Outline</Button>
        <Button size="sm" full>
          Small
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveClass('bg-surface', 'text-brand-700', 'rounded-md');
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('rounded-sm', 'w-full');
  });

  it('disabled: not clickable, 45% opacity style', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button disabled onClick={onClick}>
        Pay
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Pay' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-45');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('busy: disabled, aria-busy, ignores a second click', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button busy onClick={onClick}>
        Place order
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Place order' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is operable from the keyboard', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>Go</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ButtonLink renders a real link with the button styling', () => {
    renderWithProviders(<ButtonLink href="/doctors/remote">Find</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Find' });
    expect(link).toHaveAttribute('href', '/en-US/doctors/remote');
    expect(link).toHaveClass('bg-action', 'text-action-label');
  });
});

describe('Badge and status colour mapping', () => {
  it.each<[StatusKind, string]>([
    ['available', 'ok'],
    ['free', 'ok'],
    ['ready', 'ok'],
    ['normal', 'ok'],
    ['processing', 'wait'],
    ['out-of-range', 'no'],
    ['next-availability', 'info'],
  ])('%s maps to %s', (status, variant) => {
    expect(statusVariant(status)).toBe(variant);
  });

  it('Green means available or free: only available/free/ready use the success colours', () => {
    const green = (['available', 'free', 'ready', 'normal', 'processing', 'out-of-range', 'next-availability'] as StatusKind[]).filter(
      (status) => statusVariant(status) === 'ok',
    );
    expect(green).toEqual(['available', 'free', 'ready', 'normal']);
  });

  it('uses the -700 text tokens on the -50 fills for every variant', () => {
    renderWithProviders(
      <>
        <Badge variant="ok">a</Badge>
        <Badge variant="wait">b</Badge>
        <Badge variant="info">c</Badge>
        <Badge variant="no">d</Badge>
        <Badge variant="neutral">e</Badge>
      </>,
    );
    expect(screen.getByText('a')).toHaveClass('bg-success-50', 'text-success-700');
    expect(screen.getByText('b')).toHaveClass('bg-warning-50', 'text-warning-700');
    expect(screen.getByText('c')).toHaveClass('bg-info-50', 'text-info-700');
    expect(screen.getByText('d')).toHaveClass('bg-danger-50', 'text-danger-700');
    expect(screen.getByText('e')).toHaveClass('bg-neutral-50', 'text-neutral-600');
    expect(screen.getByText('a')).toHaveClass('rounded-sm');
  });
});

describe('Card, Avatar, PageHead', () => {
  it('Card: white surface, large radius, small shadow', () => {
    renderWithProviders(<Card data-testid="card">x</Card>);
    expect(screen.getByTestId('card')).toHaveClass('bg-surface', 'rounded-lg', 'shadow-sm');
  });

  it('Avatar: initials on peach are decorative; a portrait has alt text', () => {
    const { container, rerender } = renderWithProviders(<Avatar initials="AO" />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('AO');
    expect(container.firstElementChild?.className).toContain('--gradient-peach');
    rerender(<Avatar initials="AO" src="https://images.example.test/a.jpg" name="Dr. Okafor" size="lg" />);
    expect(screen.getByRole('img', { name: 'Dr. Okafor' })).toBeInTheDocument();
    expect(screen.queryByText('AO')).toBeNull();
  });

  it('Avatar sizes: 36, 56 and 104 px classes', () => {
    const { container } = renderWithProviders(
      <>
        <Avatar initials="A" size="sm" />
        <Avatar initials="B" size="md" />
        <Avatar initials="C" size="lg" />
      </>,
    );
    const [sm, md, lg] = Array.from(container.querySelectorAll('[data-size]'));
    expect(sm).toHaveClass('size-9');
    expect(md).toHaveClass('size-14');
    expect(lg).toHaveClass('size-26');
  });

  it('PageHead: H1 and sub on the sky gradient', () => {
    const { container } = renderWithProviders(<PageHead title="Remote sessions" sub="See a doctor by video." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Remote sessions' })).toBeInTheDocument();
    expect(screen.getByText('See a doctor by video.')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('--gradient-sky');
  });
});
