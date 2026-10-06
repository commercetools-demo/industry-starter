import { render, screen } from '@testing-library/react';
import { Input, Select, Textarea } from './Field';

describe('Field controls', () => {
  it('Input: label is associated with the control', () => {
    render(<Input label="Email" name="email" />);
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveClass('input');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('Input: error sets aria-invalid, aria-describedby points to the visible error text', () => {
    render(<Input label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const error = screen.getByText('Enter a valid email');
    expect(error).toBeVisible();
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });

  it('Textarea: label association and error wiring', () => {
    render(<Textarea label="Message" error="Required" />);
    const area = screen.getByLabelText('Message');
    expect(area.tagName).toBe('TEXTAREA');
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(area).toHaveAccessibleDescription('Required');
  });

  it('Select: label association, options and error wiring', () => {
    render(
      <Select label="Country" error="Pick one">
        <option value="US">United States</option>
      </Select>,
    );
    const select = screen.getByLabelText('Country');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Pick one');
  });

  it('two inputs get distinct ids', () => {
    render(
      <>
        <Input label="A" />
        <Input label="B" />
      </>,
    );
    expect(screen.getByLabelText('A').id).not.toBe(screen.getByLabelText('B').id);
  });

  it('honours an explicit id', () => {
    render(<Input label="Name" id="custom" />);
    expect(screen.getByLabelText('Name').id).toBe('custom');
  });
});
