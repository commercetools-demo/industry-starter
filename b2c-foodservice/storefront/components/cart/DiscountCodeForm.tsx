'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { ApiError } from '@/hooks/fetcher';
import { rejectionKey } from '@/lib/cart/discount-reasons';
import type { CartUi } from './use-cart-ui';

/**
 * Discount code field and Apply button (Enter submits). The code goes to the server as typed after trimming. A refusal shows
 * the reason inline (`role="alert"`) and the cart stays exactly as it was: the hook already replaced the cached cart with
 * the unchanged one from the error. Codes and reasons are never logged or sent to analytics.
 */
export default function DiscountCodeForm({ ui, appliedCodes = [] }: { ui: CartUi; appliedCodes?: string[] }) {
  const t = useTranslations('cart');
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const code = value.trim();
    if (!code || busy) return;
    // A code that is already on the bag is not sent again (Duplicate code).
    if (appliedCodes.some((c) => c.toLowerCase() === code.toLowerCase())) {
      setError(t('code.error.alreadyApplied'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ui.mutations.applyCode(code);
      setValue('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'code_not_applied') {
        const reason = (err.extra.details as { reason?: unknown } | undefined)?.reason;
        setError(t(rejectionKey(reason)));
      } else {
        ui.report(err);
        setError(t('code.error.generic'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-5">
      <label htmlFor={id} className="sr-only">
        {t('code.label')}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          shape="pill"
          value={value}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('code.label')}
          invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null); // the refusal belonged to the previous text
          }}
        />
        <Button type="submit" variant="ghost" loading={busy} className="shrink-0 !px-5 !py-3">
          {t('code.apply')}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12.5px] font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}
