import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from './cx';

export interface ControlA11yProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

export interface FieldProps {
  label: string;
  /** Helper text shown under the control. */
  hint?: string;
  /** Error text; also marks the control invalid. */
  error?: string;
  /** Appends "(optional)" to the label. */
  optional?: boolean;
  /** Pass `id` to use your own control id instead of a generated one. */
  id?: string;
  className?: string;
  /** Render the control with the ids and ARIA attributes that tie it to the label, hint and error. */
  children: (props: ControlA11yProps) => ReactNode;
}

/** Label + control + hint + error, associated through `htmlFor`/`aria-describedby`. */
export function Field({ label, hint, error, optional, id, className, children }: FieldProps) {
  const t = useTranslations('ui');
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('grid gap-1.5 text-[length:var(--text-sm)]', className)}>
      <label htmlFor={controlId} className="font-medium text-navy-700">
        {label}
        {optional ? <span className="ml-1 font-normal text-neutral-600">({t('optional')})</span> : null}
      </label>
      {children({ id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
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

/** Filled neutral-25 control with a 1 px border; the global focus ring stays (no outline removal). */
export const CONTROL_CLASSES =
  'w-full min-w-0 rounded-md border border-border bg-neutral-25 px-3.5 font-display text-sm text-navy-900 placeholder:text-text-placeholder focus:border-brand-500 focus:bg-surface aria-[invalid=true]:border-danger-700';
