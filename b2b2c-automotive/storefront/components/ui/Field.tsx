// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useId, type InputHTMLAttributes } from 'react';

export const INPUT_CLASS = 'min-h-7 w-full rounded-xs border border-border-input bg-surface px-3 font-ui text-sm text-text placeholder:text-text-subtle';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/** Labelled text input with an optional hint and error, both announced through `aria-describedby`. */
export function Field({ label, hint, error, id, className = '', ...rest }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">
        {label}
      </label>
      <input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={`${INPUT_CLASS} ${className}`.trim()} {...rest} />
      {hint ? (
        <p id={hintId} className="font-ui text-xs text-text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="font-ui text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
