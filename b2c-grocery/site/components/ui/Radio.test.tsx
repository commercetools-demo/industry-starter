import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Radio } from './Radio';
import { Segmented } from './Segmented';

describe('Radio', () => {
  it('is a real radio input with an accessible name, and arrow keys move the selection', async () => {
    const onChange = vi.fn();
    render(
      <fieldset>
        <Radio name="size" value="s" label="Small" defaultChecked onChange={onChange} />
        <Radio name="size" value="m" label="Medium" onChange={onChange} />
      </fieldset>,
    );
    const small = screen.getByRole('radio', { name: 'Small' });
    const medium = screen.getByRole('radio', { name: 'Medium' });
    expect(small).toBeChecked();
    small.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(medium).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
];

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <Segmented
      label="Sort"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('Segmented', () => {
  it('renders a labelled radiogroup with the current value checked', () => {
    render(<Harness onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Sort' })).toHaveClass('seg');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
  });

  it('click selects and calls onChange exactly once', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
  });

  it('arrow keys change the selection natively', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a disabled option is not selectable', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const gamma = screen.getByRole('radio', { name: 'Gamma' });
    expect(gamma).toBeDisabled();
    await userEvent.click(screen.getByText('Gamma'));
    expect(onChange).not.toHaveBeenCalled();
    expect(gamma).not.toBeChecked();
  });

  it('renders without a controlled wrapper', () => {
    render(<Segmented label="x" options={OPTIONS} value="b" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
  });
});
