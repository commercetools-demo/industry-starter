import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Field, Input, Select, Textarea } from './Field';

describe('Field', () => {
  it('Field shows its label above and the error text with aria-describedby', () => {
    render(
      <Field label="Email" htmlFor="email" error="Enter a valid email">
        <Input id="email" invalid aria-describedby="email-error" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    const error = screen.getByText('Enter a valid email');
    expect(error).toHaveAttribute('id', 'email-error');
    expect(error.className).toContain('text-danger-text');
    expect(input.className).toContain('border-danger');
    const label = screen.getByText('Email');
    expect(label.className).toContain('font-semibold');
    expect(label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Field shows the hint until there is an error', () => {
    const { rerender } = render(
      <Field label="Name" htmlFor="n" hint="As on the card">
        <Input id="n" />
      </Field>,
    );
    expect(screen.getByText('As on the card')).toHaveAttribute('id', 'n-hint');
    rerender(
      <Field label="Name" htmlFor="n" hint="As on the card" error="Required">
        <Input id="n" />
      </Field>,
    );
    expect(screen.queryByText('As on the card')).toBeNull();
  });

  it('Input focus uses the ring token', () => {
    render(<Input aria-label="q" />);
    const c = screen.getByLabelText('q').className;
    expect(c).toContain('focus:ring-ring');
    expect(c).toContain('focus:border-accent');
    expect(c).toContain('rounded-field');
  });

  it('Input pill shape is used for search', () => {
    render(<Input aria-label="q" shape="pill" />);
    expect(screen.getByLabelText('q').className).toContain('rounded-pill');
  });

  it('Select and Textarea forward refs and share the field radius', () => {
    const selectRef = createRef<HTMLSelectElement>();
    const areaRef = createRef<HTMLTextAreaElement>();
    render(
      <>
        <Select ref={selectRef} aria-label="s">
          <option>a</option>
        </Select>
        <Textarea ref={areaRef} aria-label="t" />
      </>,
    );
    expect(selectRef.current).toBe(screen.getByLabelText('s'));
    expect(areaRef.current).toBe(screen.getByLabelText('t'));
    expect(screen.getByLabelText('t').className).toContain('rounded-field');
  });
});
