import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HeartButton } from './HeartButton';
import { QuantityStepper } from './QuantityStepper';

const labels = { decreaseLabel: 'Fewer', increaseLabel: 'More' };

describe('QuantityStepper', () => {
  it('accessible names come from props', () => {
    render(<QuantityStepper value={2} onChange={() => {}} {...labels} />);
    expect(screen.getByRole('button', { name: 'Fewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('min 1 clamp: decrease is disabled at 1 and never emits 0', async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} onChange={onChange} {...labels} />);
    const dec = screen.getByRole('button', { name: 'Fewer' });
    expect(dec).toBeDisabled();
    await userEvent.click(dec);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('max disables increase', async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={3} max={3} onChange={onChange} {...labels} />);
    const inc = screen.getByRole('button', { name: 'More' });
    expect(inc).toBeDisabled();
    await userEvent.click(inc);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('steps by one within the limits', async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} max={5} onChange={onChange} {...labels} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fewer' }));
    expect(onChange).toHaveBeenNthCalledWith(1, 3);
    expect(onChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('shows the count', () => {
    render(<QuantityStepper value={4} onChange={() => {}} {...labels} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

function HeartHarness() {
  const [on, setOn] = useState(false);
  return <HeartButton pressed={on} onToggle={() => setOn(!on)} label="Save to list" />;
}

describe('HeartButton', () => {
  it('aria-pressed toggles and the accessible name comes from props', async () => {
    render(<HeartHarness />);
    const button = screen.getByRole('button', { name: 'Save to list' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('text-accent');
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'none');
  });
});
