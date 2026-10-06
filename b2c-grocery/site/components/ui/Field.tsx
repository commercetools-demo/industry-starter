import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

export const errorIdFor = (id: string) => `${id}-error`;

type FieldProps = { id: string; label: ReactNode; error?: string; className?: string; children: ReactNode };

/** Label above a control, error text below. The control must use `id` and, when invalid, `aria-describedby={errorIdFor(id)}`. */
export function Field({ id, label, error, className, children }: FieldProps) {
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={errorIdFor(id)} className="mt-1 mb-0 text-xs text-accent-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Shared = { label: ReactNode; error?: string; fieldClassName?: string };

function a11y(id: string, error?: string) {
  return error ? { 'aria-invalid': true as const, 'aria-describedby': errorIdFor(id) } : {};
}

export function Input({ label, error, fieldClassName, id: idProp, className, ...rest }: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <Field id={id} label={label} error={error} className={fieldClassName}>
      <input id={id} className={cx('input', className)} {...a11y(id, error)} {...rest} />
    </Field>
  );
}

export function Textarea({ label, error, fieldClassName, id: idProp, className, ...rest }: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <Field id={id} label={label} error={error} className={fieldClassName}>
      <textarea id={id} className={cx('input', className)} {...a11y(id, error)} {...rest} />
    </Field>
  );
}

export function Select({ label, error, fieldClassName, id: idProp, className, children, ...rest }: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <Field id={id} label={label} error={error} className={fieldClassName}>
      <select id={id} className={cx('input', className)} {...a11y(id, error)} {...rest}>
        {children}
      </select>
    </Field>
  );
}
