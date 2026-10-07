'use client';

import { createContext, useContext, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import { FOCUS_RING } from './focus';

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean };

const FieldContext = createContext<FieldContextValue | null>(null);

type FieldProps = {
  label: string;
  /** Overrides the generated control id. */
  htmlFor?: string;
  hint?: string;
  error?: string;
  /** Announce the error (`role="alert"`): set it only for an error that appears after a submit. */
  errorLive?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint + error with the ARIA wiring. Put one `Input`, `Select` or `Textarea` inside. */
export function Field({ label, htmlFor, hint, error, errorLive, className, children }: FieldProps): ReactElement {
  const generated = useId();
  const id = htmlFor ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cx('flex flex-col gap-3', className)}>
        <label htmlFor={id} className="font-display text-sm font-semibold tracking-ui">
          {label}
        </label>
        {children}
        {hint ? (
          <p id={hintId} className="m-0 text-sm text-text-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role={errorLive ? 'alert' : undefined} className="m-0 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps(): { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: true } {
  const ctx = useContext(FieldContext);
  if (!ctx) return {};
  return { id: ctx.id, 'aria-describedby': ctx.describedBy, 'aria-invalid': ctx.invalid ? true : undefined };
}

const CONTROL = 'w-full border border-neutral-400 bg-surface px-6 text-md text-text';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  const wired = useFieldProps();
  return <input {...wired} {...rest} className={cx(CONTROL, 'min-h-11 rounded-pill', FOCUS_RING, className)} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  const wired = useFieldProps();
  return <select {...wired} {...rest} className={cx(CONTROL, 'min-h-11 rounded-pill', FOCUS_RING, className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  const wired = useFieldProps();
  return <textarea {...wired} {...rest} className={cx(CONTROL, 'rounded-lg py-3', FOCUS_RING, className)} />;
}
