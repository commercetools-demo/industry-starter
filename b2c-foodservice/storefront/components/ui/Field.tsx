import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  /** The id of the control. The caller sets the same id, and aria-describedby when error or hint is shown. */
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label above a control, with optional hint (`${htmlFor}-hint`) and error (`${htmlFor}-error`) text. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold tracking-[0.02em] text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[12.5px] text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[12.5px] font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'transition-state w-full border bg-surface px-[14px] py-[13px] font-body text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-ring';

function controlClasses(invalid: boolean | undefined, radius: string, className?: string): string {
  return cn(CONTROL, radius, invalid ? 'border-danger' : 'border-line-2', className);
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { shape?: 'field' | 'pill'; invalid?: boolean }
>(function Input({ shape = 'field', invalid, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, shape === 'pill' ? 'rounded-pill' : 'rounded-field', className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, className, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, 'rounded-field', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={controlClasses(invalid, 'rounded-field', cn('min-h-24', className))}
      {...props}
    />
  );
});
