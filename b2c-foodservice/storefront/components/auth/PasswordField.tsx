'use client';

import { useTranslations } from 'next-intl';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import Icon from '@/components/ui/Icon';
import { Field, Input } from '@/components/ui/Field';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  id: string;
  label: string;
  error?: string;
  /** Ids of further descriptions (for example the strength list), appended to aria-describedby. */
  describedBy?: string;
}

/** Password input with a trailing show/hide button (38px target, `aria-pressed`, labelled by state). */
const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { id, label, error, describedBy, ...props },
  ref,
) {
  const t = useTranslations('auth.password');
  const [visible, setVisible] = useState(false);
  const described = [error ? `${id}-error` : null, describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          invalid={Boolean(error)}
          aria-describedby={described}
          className="pr-12"
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? t('hide') : t('show')}
          onClick={() => setVisible((v) => !v)}
          className="transition-state absolute right-1 top-1/2 inline-flex h-[38px] w-[38px] -translate-y-1/2 items-center justify-center rounded-pill text-ink-2 hover:bg-ink/6"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
    </Field>
  );
});

export default PasswordField;
