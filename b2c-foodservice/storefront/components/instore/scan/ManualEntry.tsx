'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import { normaliseScan } from '@/lib/instore/scan';

/**
 * Type the code printed under the barcode (workstream R). It is the way in when the camera is denied, missing or cannot read a
 * worn label. A text that is not shaped like a SKU is explained here and never sent anywhere.
 */
export default function ManualEntry({ busy, onSubmit }: { busy: boolean; onSubmit: (raw: string) => void }) {
  const t = useTranslations('instore.scan.manual');
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = normaliseScan(value);
    if (!parsed.ok) {
      setError(true);
      return;
    }
    setError(false);
    onSubmit(parsed.sku);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2" data-testid="manual-entry">
      <label htmlFor={id} className="text-[14px] font-semibold text-ink">
        {t('label')}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('placeholder')}
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-14 min-w-0 flex-1 rounded-field border border-line-2 bg-surface px-4 font-mono text-[16px] text-ink placeholder:text-ink-3"
        />
        <Button type="submit" size="lg" variant="ink" disabled={busy} className="h-14 shrink-0 px-6">
          {t('submit')}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 text-[13.5px] font-medium text-danger-text">
          {t('invalid')}
        </p>
      ) : null}
    </form>
  );
}
