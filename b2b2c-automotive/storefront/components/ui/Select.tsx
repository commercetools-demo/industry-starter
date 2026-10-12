// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useId, type SelectHTMLAttributes } from 'react';
import { INPUT_CLASS } from '@/components/ui/Field';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

/** Labelled native select, 48 px tall like Field. Options are children. */
export function Select({ label, hint, error, id, className = '', children, ...rest }: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">
        {label}
      </label>
      <select id={selectId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={`${INPUT_CLASS} ${className}`.trim()} {...rest}>
        {children}
      </select>
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
