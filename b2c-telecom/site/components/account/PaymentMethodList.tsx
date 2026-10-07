'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { SWRConfig } from 'swr';
import { ConfirmDialog } from '@/components/bundle/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { FOCUS_RING } from '@/components/ui/focus';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { usePaymentMethodMutations, usePaymentMethods } from '@/hooks/usePaymentMethods';
import { KEY_PAYMENT_METHODS } from '@/lib/cache-keys';
import { cx } from '@/lib/cx';
import type { PaymentMethodView } from '@/lib/types';

const ACTION = cx('min-h-9 bg-transparent p-0 font-display text-sm font-semibold text-text-link underline underline-offset-4 disabled:opacity-50', FOCUS_RING);

function List(): ReactElement {
  const t = useTranslations('account.paymentMethods');
  const toast = useToast();
  const { paymentMethods } = usePaymentMethods();
  const { makeDefault, remove } = usePaymentMethodMutations();
  const [removing, setRemoving] = useState<PaymentMethodView | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.show({ message: t('errors.generic'), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const labelOf = (method: PaymentMethodView): string =>
    method.last4 ? t('cardLabel', { brand: t(`brand.${method.brand}`), last4: method.last4 }) : method.label || t('savedCard');

  if (paymentMethods.length === 0) {
    return (
      <section aria-labelledby="payment-methods-empty" className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface p-9 text-center">
        <h2 id="payment-methods-empty" className="m-0 font-display text-2xl font-bold">
          {t('empty.title')}
        </h2>
        <p className="m-0 max-w-prose text-md">{t('empty.body')}</p>
        <Button href="/bundle">{t('empty.cta')}</Button>
      </section>
    );
  }

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {paymentMethods.map((method) => (
          <li key={method.id} className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl border border-border bg-surface p-7">
            <Tag tone="neutral">{t(`brand.${method.brand}`)}</Tag>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-lg font-bold">{labelOf(method)}</span>
              {method.expiry ? <span className="text-md text-text-muted">{t('expires', { date: method.expiry })}</span> : null}
            </div>
            {method.isDefault ? <Tag tone="pink">{t('default')}</Tag> : null}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {method.isDefault ? null : (
                <button type="button" className={ACTION} disabled={busy} onClick={() => void run(() => makeDefault(method.id))}>
                  {t('actions.makeDefault')}
                  <span className="sr-only"> {labelOf(method)}</span>
                </button>
              )}
              <button type="button" className={ACTION} disabled={busy} onClick={() => setRemoving(method)}>
                {t('actions.remove')}
                <span className="sr-only"> {labelOf(method)}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={t('remove.title')}
        confirmLabel={t('remove.confirm')}
        cancelLabel={t('remove.cancel')}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void run(() => remove(target.id));
        }}
      >
        {removing?.isDefault ? <p className="m-0">{t('remove.noDefault')}</p> : null}
      </ConfirmDialog>
    </>
  );
}

/** Lists, sets the default and removes stored payment methods (D-032: no card form). `initial` is the server's read (the SWR fallback). */
export function PaymentMethodList({ initial }: { initial: PaymentMethodView[] }): ReactElement {
  return (
    <SWRConfig value={{ fallback: { [KEY_PAYMENT_METHODS]: { paymentMethods: initial } }, revalidateOnMount: false }}>
      <List />
    </SWRConfig>
  );
}
