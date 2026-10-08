'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CONTROL_CLASSES } from '@/components/ui/Field';
import { RX_INPUT_MAX } from '@/lib/dispense/rx-number';
import type { RxQuickPick } from '@/lib/types';

export interface RxLookupFormProps {
  busy: boolean;
  /** The signed-in patient's own prescriptions, offered as quick-picks (not the prototype's demo badges). */
  quickPicks: RxQuickPick[];
  onSearch: (input: string) => void;
}

/** RX number box plus the patient's own prescriptions. The number is sent in a POST body, never in a URL. */
export function RxLookupForm({ busy, quickPicks, onSearch }: RxLookupFormProps) {
  const t = useTranslations('rx');
  const [value, setValue] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim()) onSearch(value);
  }

  return (
    <div className="mt-5 grid max-w-140 gap-3">
      <form onSubmit={submit} className="flex flex-nowrap gap-3" aria-label={t('inputLabel')}>
        <input
          type="text"
          name="rx"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('inputLabel')}
          placeholder={t('inputPlaceholder')}
          maxLength={RX_INPUT_MAX}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${CONTROL_CLASSES} h-11.5 flex-1 bg-surface`}
        />
        <Button type="submit" busy={busy}>
          {t('search')}
        </Button>
      </form>
      {quickPicks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-600">{t('yours')}:</span>
          {quickPicks.map((pick) => (
            <button
              key={pick.number}
              type="button"
              disabled={busy}
              onClick={() => {
                setValue(pick.number);
                onSearch(pick.number);
              }}
              className="cursor-pointer rounded-sm"
            >
              <Badge variant="info">{pick.number}</Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
