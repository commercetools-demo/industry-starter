import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import Stepper from './Stepper';

function Harness({ start = 2, min = 1, max = 3 }: { start?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(start);
  return <Stepper label="Quantity" value={value} min={min} max={max} onChange={setValue} />;
}

describe('Stepper', () => {
  it('Stepper increments, decrements and stops at min and max', async () => {
    renderWithIntl(<Harness />);
    const group = screen.getByRole('group', { name: 'Quantity' });
    const minus = screen.getByRole('button', { name: 'Decrease quantity' });
    const plus = screen.getByRole('button', { name: 'Increase quantity' });
    expect(group).toHaveTextContent('2');
    await userEvent.click(plus);
    expect(group).toHaveTextContent('3');
    expect(plus).toBeDisabled();
    await userEvent.click(minus);
    await userEvent.click(minus);
    expect(group).toHaveTextContent('1');
    expect(minus).toBeDisabled();
  });

  it('Stepper buttons have localized labels in en-CA', () => {
    renderWithIntl(<Stepper label="Qty" value={1} onChange={vi.fn()} />, { locale: 'en-CA' });
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument();
  });

  it('Stepper announces the value politely', () => {
    renderWithIntl(<Stepper label="Qty" value={4} onChange={vi.fn()} />);
    expect(screen.getByText('4')).toHaveAttribute('aria-live', 'polite');
  });

  it('Stepper disabled blocks both buttons', () => {
    renderWithIntl(<Stepper label="Qty" value={2} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('Stepper buttons are 38px targets', () => {
    renderWithIntl(<Stepper label="Qty" value={2} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Increase quantity' }).className).toContain('h-[38px]');
  });
});
