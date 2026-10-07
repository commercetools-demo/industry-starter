import { fireEvent, render, screen } from '@testing-library/react';
import { QuantityStepper } from './QuantityStepper';

function stepper(value: number, onChange = vi.fn(), extra: { min?: number; max?: number } = {}) {
  render(<QuantityStepper value={value} onChange={onChange} decreaseLabel="Fewer lines" increaseLabel="More lines" valueLabel="Number of lines" {...extra} />);
  return onChange;
}

describe('QuantityStepper', () => {
  it('min and max disable the buttons', () => {
    stepper(1);
    expect(screen.getByRole('button', { name: 'Fewer lines' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More lines' })).toBeEnabled();
  });

  it('the upper limit disables increase', () => {
    stepper(5);
    expect(screen.getByRole('button', { name: 'More lines' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fewer lines' })).toBeEnabled();
  });

  it('clamps a forced value into the range', () => {
    stepper(9);
    expect(screen.getByText('5')).toHaveAttribute('aria-live', 'polite');
  });

  it('accessible names come from the props', () => {
    stepper(2);
    expect(screen.getByRole('group', { name: 'Number of lines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More lines' })).toBeInTheDocument();
  });

  it('onChange is called once with the new value', () => {
    const onChange = stepper(2);
    fireEvent.click(screen.getByRole('button', { name: 'More lines' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('decrease calls onChange with value minus one', () => {
    const onChange = stepper(3);
    fireEvent.click(screen.getByRole('button', { name: 'Fewer lines' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('buttons are 44 px touch targets', () => {
    stepper(2);
    expect(screen.getByRole('button', { name: 'More lines' })).toHaveClass('size-11');
  });
});
