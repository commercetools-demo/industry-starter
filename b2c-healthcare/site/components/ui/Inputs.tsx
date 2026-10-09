import { useId, type InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { CONTROL_CLASSES, Field } from './Field';
import { cx } from './cx';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  fieldClassName?: string;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapperProps {}

export function Input({ label, hint, error, optional, fieldClassName, id, className, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={id} className={fieldClassName}>
      {(a11y) => <input {...a11y} className={cx(CONTROL_CLASSES, 'h-11.5', className)} {...rest} />}
    </Field>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldWrapperProps {
  children: ReactNode;
}

export function Select({ label, hint, error, optional, fieldClassName, id, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={id} className={fieldClassName}>
      {(a11y) => (
        <select {...a11y} className={cx(CONTROL_CLASSES, 'h-11.5', className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapperProps {}

export function Textarea({ label, hint, error, optional, fieldClassName, id, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={id} className={fieldClassName}>
      {(a11y) => <textarea {...a11y} className={cx(CONTROL_CLASSES, 'min-h-22 resize-y py-3', className)} {...rest} />}
    </Field>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
}

/** Native checkbox inside its label (the whole label is the click target). */
export function Checkbox({ label, hint, error, className, id, ...rest }: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return (
    <div className={cx('grid gap-1.5 text-sm', className)}>
      <label htmlFor={controlId} className="flex cursor-pointer items-center gap-2 text-navy-900">
        <input
          type="checkbox"
          id={controlId}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className="size-4.5 accent-brand-500"
          {...rest}
        />
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-neutral-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** Right-aligned detail, usually a price. */
  detail?: string;
}

/** Radio option as a bordered card; azure border when selected. Use the same `name` for a group. */
export function RadioCard({ label, detail, className, id, ...rest }: RadioCardProps) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-center justify-between gap-4 rounded-md border-thick border-border bg-surface p-4 text-sm text-navy-900 has-checked:border-brand-500 has-checked:bg-brand-50',
        className,
      )}
    >
      <span className="flex items-center gap-3">
        <input type="radio" id={id} className="size-4.5 accent-brand-500" {...rest} />
        <span className="font-medium">{label}</span>
      </span>
      {detail ? <span className="font-semibold text-navy-700">{detail}</span> : null}
    </label>
  );
}
