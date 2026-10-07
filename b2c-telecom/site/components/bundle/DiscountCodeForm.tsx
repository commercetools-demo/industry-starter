'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Tag';
import { FOCUS_RING } from '@/components/ui/focus';
import { CartError } from '@/hooks/useCart';
import { cx } from '@/lib/cx';
import type { CartDiscountCodeInfo, DiscountCodeReason } from '@/lib/types';

type DiscountCodeFormProps = {
  codes: CartDiscountCodeInfo[];
  onApply: (code: string) => Promise<unknown>;
  onRemove: (code: string) => Promise<unknown>;
};

const REASONS: readonly DiscountCodeReason[] = ['unknown-code', 'not-active', 'not-valid', 'not-applicable', 'max-reached', 'stopped'];
const isReason = (value: unknown): value is DiscountCodeReason => REASONS.includes(value as DiscountCodeReason);

/** Applies and removes discount codes. A refused code shows its reason under the field and changes nothing; a code that stops applying stays listed with the reason. */
export function DiscountCodeForm({ codes, onApply, onRemove }: DiscountCodeFormProps): ReactElement {
  const t = useTranslations('bundle');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const reasonText = (reason: DiscountCodeReason | null): string => t(`code.reason.${reason ?? 'not-applicable'}`);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const code = value.trim();
    if (code === '') return;
    setPending(true);
    setError(undefined);
    try {
      await onApply(code);
      setValue('');
    } catch (err) {
      const reason = err instanceof CartError ? err.details?.reason : undefined;
      setError(isReason(reason) ? reasonText(reason) : t('error.generic'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex items-start gap-3" noValidate>
        <Field label={t('code.label')} error={error} errorLive className="flex-1">
          <Input value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        </Field>
        <Button type="submit" variant="secondary" loading={pending} className="mt-8">
          {t('code.apply')}
        </Button>
      </form>
      {codes.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {codes.map((entry) => (
            <li key={entry.code} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Tag tone={entry.state === 'applied' ? 'pink' : 'neutral'}>{entry.code}</Tag>
                <button
                  type="button"
                  aria-label={`${t('code.remove')}: ${entry.code}`}
                  onClick={() => void onRemove(entry.code).catch(() => setError(t('error.generic')))}
                  className={cx('rounded-pill bg-transparent px-2 font-display text-sm font-semibold text-text', FOCUS_RING)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              {entry.state === 'applied' ? (
                <span className="sr-only">{t('code.applied', { code: entry.code })}</span>
              ) : (
                <p role="status" className="m-0 text-sm text-text-muted">
                  {t('code.noLonger', { code: entry.code, reason: reasonText(entry.reason) })}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
