'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import PanelState from '@/components/account/PanelState';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/context/toast';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

/**
 * Saved payment methods. The hosted Checkout stores them (D-039); this tab lists, removes and sets the default. There is no
 * add button and no card form here, and no card number: a method shows its label (or "Card") and a Default tag.
 */
export default function PaymentMethodsTab() {
  const t = useTranslations('account.payments');
  const tTabs = useTranslations('account.tabs');
  const toast = useToast();
  const pm = usePaymentMethods();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>, done?: string) => {
    setBusy(id);
    try {
      await action();
      if (done) toast.show(done);
    } catch {
      toast.show(t('failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="payments-heading">
      <h2 id="payments-heading" className="m-0 mb-[18px] font-display text-[22px] font-bold text-ink">
        {t('title')}
      </h2>
      <PanelState
        panel={tTabs('payments')}
        isLoading={pm.isLoading && !pm.methods}
        isError={pm.isError && !pm.methods}
        isEmpty={Boolean(pm.methods) && pm.methods!.length === 0}
        onRetry={() => void pm.reload()}
        empty={
          <>
            <p className="m-0 mb-1 text-[14.5px] font-semibold text-ink">{t('empty')}</p>
            <p className="m-0 mb-3 text-[14px] text-ink-2">{t('emptyHelp')}</p>
            <p className="m-0 mb-4 text-[13.5px] text-ink-3">{t('hostedOnly')}</p>
            <ButtonLink variant="ghost" href="/shop">
              {t('shop')}
            </ButtonLink>
          </>
        }
      >
        <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('list')}>
          {(pm.methods ?? []).map((m) => (
            <li key={m.id}>
              <Card className="p-5" data-testid="payment-method">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="m-0 flex items-center gap-3 font-display text-[16px] font-semibold text-ink">
                    <Icon name="card" size={20} />
                    {m.label || (m.method === 'card' ? t('method.card') : m.method || t('method.card'))}
                    {m.isDefault ? (
                      <span className="rounded-pill bg-accent/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-press">{t('default')}</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {!m.isDefault ? (
                      <Button variant="ghost" loading={busy === m.id} onClick={() => void run(m.id, () => pm.makeDefault(m.id))}>
                        {t('makeDefault')}
                      </Button>
                    ) : null}
                    <Button variant="ghost" loading={busy === m.id} onClick={() => void run(m.id, () => pm.remove(m.id), t('removed'))}>
                      {t('remove')}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-4 text-[13px] text-ink-3">{t('hostedOnly')}</p>
      </PanelState>
    </section>
  );
}
