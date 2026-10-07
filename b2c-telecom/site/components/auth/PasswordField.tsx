'use client';

import { useState, type InputHTMLAttributes, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Field, Input } from '@/components/ui/Field';
import { PASSWORD_POLICY } from '@/lib/config/password';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  label: string;
  /** Field-level error line under the control (wired through `Field`). */
  error?: string | undefined;
};

/**
 * Password input with a show/hide toggle. `autoComplete` must be given by the caller (`current-password` or `new-password`).
 * The value is never trimmed. A caller that renders its own error line passes `aria-invalid` / `aria-describedby`, which win over
 * the wiring of `Field`.
 */
export function PasswordField({ label, error, id, className, ...rest }: Props): ReactElement {
  const t = useTranslations('auth.password');
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} error={error} errorLive {...(id ? { htmlFor: id } : {})}>
      <div className="relative">
        <Input {...rest} {...(id ? { id } : {})} type={shown ? 'text' : 'password'} maxLength={PASSWORD_POLICY.maxLength} className={className ? `pr-24 ${className}` : 'pr-24'} />
        <button
          type="button"
          aria-pressed={shown}
          onClick={() => setShown((current) => !current)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-pill px-3 py-2 font-display text-sm font-semibold text-text-link ${FOCUS_RING}`}
        >
          {shown ? t('hide') : t('show')}
        </button>
      </div>
    </Field>
  );
}
