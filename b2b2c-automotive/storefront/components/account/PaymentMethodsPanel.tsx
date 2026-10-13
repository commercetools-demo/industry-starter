// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Notice, PageTitle, Panel, StateMessage } from '@/components/account/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

/**
 * Saved payment methods (tokenised: label, last four, expiry only). There is no "Add": methods are saved inside the hosted Checkout (for example for
 * a subscription), and the empty state says so. A delete asks first; with subscriptions on the account it warns, because the recurring order does not
 * say which method it uses (so a delete cannot be blocked).
 */
export function PaymentMethodsPanel() {
  const t = useTranslations('account.payment');
  const tc = useTranslations('account');
  const { methods, hasSubscriptions, isLoading, error, reload, remove } = usePaymentMethods();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function onDelete(id: string) {
    setFailed(false);
    try {
      await remove(id);
      setConfirming(null);
    } catch {
      setFailed(true);
    }
  }

  let body;
  if (isLoading && !methods) body = <StateMessage kind="loading" />;
  else if (error || !methods) body = <StateMessage kind="error" onRetry={() => void reload()} />;
  else if (methods.length === 0) body = <StateMessage kind="empty" title={t('empty')} />;
  else {
    body = (
      <Panel>
        {hasSubscriptions ? <p className="m-0 rounded-xs bg-warning-50 px-3 py-2 font-ui text-sm text-text-body">{t('subscriptionWarning')}</p> : null}
        <ul aria-label={t('listLabel')} className="m-0 grid list-none gap-3 p-0">
          {methods.map((m) => (
            <li key={m.id} className="grid gap-3 rounded-sm border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-md font-semibold text-text">{m.label}</span>
                {m.last4 ? <span className="font-ui text-sm text-text-body">{t('ending', { last4: m.last4 })}</span> : null}
                {m.expiry ? <span className="font-ui text-sm text-text-muted">{t('expires', { expiry: m.expiry })}</span> : null}
                {m.isDefault ? <Badge tone="success">{t('default')}</Badge> : null}
              </div>
              {confirming === m.id ? (
                <div role="group" aria-label={t('deleteConfirm')} className="grid gap-3">
                  <p className="m-0 font-ui text-sm text-text">{t('deleteConfirm')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => onDelete(m.id)}>{t('deleteYes')}</Button>
                    <Button variant="secondary" onClick={() => setConfirming(null)}>
                      {tc('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button variant="link" aria-label={t('deleteLabel', { label: m.label })} onClick={() => setConfirming(m.id)}>
                    {t('delete')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <Notice tone="error">{failed ? t('failed') : null}</Notice>
      {body}
    </div>
  );
}
