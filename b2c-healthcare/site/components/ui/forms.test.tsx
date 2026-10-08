import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/utils';
import { Checkbox, Input, RadioCard, Select, Textarea } from './Inputs';

describe('Form primitives', () => {
  it('Input: the label is associated with the control', async () => {
    renderWithProviders(<Input label="Email" type="email" />);
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    await userEvent.click(screen.getByText('Email'));
    expect(input).toHaveFocus();
  });

  it('Input: error text is linked with aria-describedby and marks the control invalid', () => {
    renderWithProviders(<Input label="Email" error="Enter a valid email address." hint="We never share it." />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const texts = describedBy.split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual(['We never share it.', 'Enter a valid email address.']);
    expect(input).toHaveAccessibleDescription('We never share it. Enter a valid email address.');
  });

  it('Input without an error is not invalid and has no empty description', () => {
    renderWithProviders(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('Input: an explicit id is kept; two inputs get different generated ids', () => {
    renderWithProviders(
      <>
        <Input label="A" id="custom" />
        <Input label="B" />
        <Input label="C" />
      </>,
    );
    expect(screen.getByLabelText('A')).toHaveAttribute('id', 'custom');
    expect(screen.getByLabelText('B').id).not.toBe(screen.getByLabelText('C').id);
  });

  it('optional fields say so', () => {
    renderWithProviders(<Input label="Phone" optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('Select and Textarea: label association and error text', () => {
    renderWithProviders(
      <>
        <Select label="Specialty" error="Pick one.">
          <option value="">Any</option>
          <option value="gp">General practice</option>
        </Select>
        <Textarea label="Reason" />
      </>,
    );
    const select = screen.getByLabelText('Specialty');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAccessibleDescription('Pick one.');
    expect(screen.getByLabelText('Reason').tagName).toBe('TEXTAREA');
  });

  it('filled neutral-25 style and the focus ring is never removed (no outline: none)', () => {
    renderWithProviders(
      <>
        <Input label="A" />
        <Select label="B">
          <option>x</option>
        </Select>
        <Textarea label="C" />
      </>,
    );
    for (const label of ['A', 'B', 'C']) {
      const control = screen.getByLabelText(label);
      expect(control).toHaveClass('bg-neutral-25', 'border', 'rounded-md');
      expect(control.className).not.toMatch(/outline-(none|0|hidden)/);
    }
  });

  it('Checkbox: the label toggles it; the hint is described', async () => {
    renderWithProviders(<Checkbox label="Available today" hint="Only doctors with a free slot." />);
    const box = screen.getByLabelText('Available today');
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Available today'));
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription('Only doctors with a free slot.');
  });

  it('RadioCard: one choice in a group, selected card gets the selected style hook, price on the right', async () => {
    renderWithProviders(
      <fieldset>
        <legend>Delivery</legend>
        <RadioCard name="ship" value="std" label="Standard" detail="Free" />
        <RadioCard name="ship" value="same" label="Same-day" detail="$5.00" />
      </fieldset>,
    );
    const std = screen.getByRole('radio', { name: /Standard/ });
    const same = screen.getByRole('radio', { name: /Same-day/ });
    await userEvent.click(same);
    expect(same).toBeChecked();
    expect(std).not.toBeChecked();
    await userEvent.keyboard('{ArrowUp}');
    expect(std).toBeChecked();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(same.closest('label')).toHaveClass('has-checked:border-brand-500');
  });
});
