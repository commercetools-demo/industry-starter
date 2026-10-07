import { render, screen } from '@testing-library/react';
import { Field, Input, Select, Textarea } from './Field';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field label="Email">
        <Input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toBeInstanceOf(HTMLInputElement);
  });

  it('error sets aria-invalid and aria-describedby pointing at the visible error text', () => {
    render(
      <Field label="Email" error="Enter a valid email">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const error = screen.getByText('Enter a valid email');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(error).toHaveClass('text-danger');
    expect(error).not.toHaveAttribute('role');
  });

  it('errorLive adds role alert', () => {
    render(
      <Field label="Email" error="Required" errorLive>
        <Input />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('hint is wired into aria-describedby and no aria-invalid without an error', () => {
    render(
      <Field label="Password" hint="At least 12 characters">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('At least 12 characters').id);
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('hint and error are both listed', () => {
    render(
      <Field label="Name" hint="Hint" error="Error">
        <Input />
      </Field>,
    );
    const ids = screen.getByLabelText('Name').getAttribute('aria-describedby')?.split(' ');
    expect(ids).toEqual([screen.getByText('Hint').id, screen.getByText('Error').id]);
  });

  it('every control has the focus ring and the pill or rounded shape', () => {
    render(
      <>
        <Field label="A">
          <Input />
        </Field>
        <Field label="B">
          <Select>
            <option>x</option>
          </Select>
        </Field>
        <Field label="C">
          <Textarea />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('A')).toHaveClass('focus-visible:outline-2', 'rounded-pill', 'min-h-11');
    expect(screen.getByLabelText('B')).toHaveClass('focus-visible:outline-2', 'rounded-pill');
    expect(screen.getByLabelText('C')).toHaveClass('focus-visible:outline-2', 'rounded-lg');
  });

  it('htmlFor overrides the generated id', () => {
    render(
      <Field label="Code" htmlFor="code-field">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Code')).toHaveAttribute('id', 'code-field');
  });
});
