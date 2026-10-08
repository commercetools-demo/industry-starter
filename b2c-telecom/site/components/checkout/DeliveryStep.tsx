'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { Locale, ShippingOption } from '@/lib/types';
import type { CheckoutApi } from './types';
import { useCheckoutErrorText } from './useCheckoutError';

type Props = { checkout: CheckoutApi; onDone: () => void };

/**
 * Step 3 (physical bundles only). The options are the platform's matching list, read when the step opens (the address may have changed the
 * answer); the price shown is the one returned, never assumed free. One option is preselected: the method already on the cart when it is
 * still offered, else the first returned. An empty list says so, says what to change, and leaves Continue disabled.
 */
export function DeliveryStep({ checkout, onDone }: Props): ReactElement {
  const t = useTranslations('checkout');
  const locale = useLocale() as Locale;
  const errorText = useCheckoutErrorText();
  const groupId = useId();
  const { loadDelivery, selectDelivery } = checkout;
  const current = checkout.state.delivery?.id;
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    loadDelivery()
      .then((result) => {
        setOptions(result.options);
        setSelected(result.options.find((option) => option.id === current)?.id ?? result.options[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        setOptions([]);
        setFailure(errorText(error));
      });
  }, [loadDelivery, current, errorText]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selected) return;
    setFailure(null);
    if (selected === current) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      await selectDelivery(selected);
      onDone();
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const none = options !== null && options.length === 0;
  return (
    <form onSubmit={submit} className="flex flex-col gap-6" aria-labelledby="checkout-delivery">
      <h2 id="checkout-delivery" className="m-0 font-display text-2xl font-bold tracking-ui">
        {t('delivery.heading')}
      </h2>
      {options === null ? (
        <p role="status" className="m-0 text-md text-text-muted">
          {t('delivery.loading')}
        </p>
      ) : none ? (
        <div className="flex flex-col gap-4 rounded-xl border-2 border-border bg-surface p-5">
          <p className="m-0 font-semibold">{t('delivery.none.title')}</p>
          <p className="m-0 text-md text-text-muted">{t('delivery.none.body')}</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/bundle/checkout?step=address" className={cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
              {t('delivery.none.change')}
            </Link>
            <Link href="/bundle" className={cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
              {t('delivery.none.bundle')}
            </Link>
          </div>
        </div>
      ) : (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="sr-only">{t('delivery.heading')}</legend>
          {options.map((option) => (
            <label key={option.id} className={cx('flex cursor-pointer items-center gap-4 rounded-xl border p-5', selected === option.id ? 'border-action bg-pink-50' : 'border-border bg-surface')}>
              <input type="radio" name={groupId} className="size-5 shrink-0 accent-action" checked={selected === option.id} onChange={() => setSelected(option.id)} />
              <span className="text-md">
                {option.name} · {formatMoneyExact(option.price, locale)}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {failure ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {failure}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={busy} disabled={options === null || none || !selected}>
          {t('continue')}
        </Button>
      </div>
    </form>
  );
}
