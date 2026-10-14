// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Notice, PageTitle, Panel, StateMessage } from '@/components/account/Panel';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { errorCodeOf } from '@/hooks/account-fetch';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { Link } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import type { SubscriptionAction, SubscriptionStatus, SubscriptionView } from '@/lib/types';

const TONE: Record<SubscriptionStatus, BadgeTone> = { active: 'success', paused: 'warning', canceled: 'neutral', expired: 'neutral', failed: 'danger' };
const ERRORS = ['busy', 'not-active', 'skip-pending', 'unknown-policy'];

type Pending = { id: string; kind: 'cancel' } | { id: string; kind: 'frequency'; policyKey: string } | { id: string; kind: 'choose'; policyKey: string };

/**
 * The shopper's subscriptions (recurring orders): status, frequency, next delivery (the API's date), items, and the actions Skip, Pause, Resume,
 * Change frequency (asks first) and Cancel (asks first). A failed payment shows the plain message with a link to the payment methods and Resume.
 */
export function SubscriptionList({ store, timeZone }: { store: string; timeZone?: string }) {
  const t = useTranslations('account.subscriptions');
  const tc = useTranslations('account');
  const locale = useLocale();
  const { subscriptions, policies, isLoading, error, reload, run } = useSubscriptions();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function act(sub: SubscriptionView, action: SubscriptionAction, policyKey?: string) {
    setBusy(sub.id);
    setMessage(null);
    try {
      await run(sub.id, action, policyKey);
      setMessage({ tone: 'success', text: t('done') });
      setPending(null);
    } catch (failure) {
      const code = errorCodeOf(failure);
      setMessage({ tone: 'error', text: t(`errors.${ERRORS.includes(code) ? code : 'generic'}` as 'errors.generic') });
    }
    setBusy(null);
  }

  let body;
  if (isLoading && !subscriptions) body = <StateMessage kind="loading" />;
  else if (error || !subscriptions) body = <StateMessage kind="error" onRetry={() => void reload()} />;
  else if (subscriptions.length === 0) {
    body = (
      <StateMessage
        kind="empty"
        title={t('empty')}
        action={
          <Link href={`/${store}/parts`} className={buttonClass('primary')}>
            {t('emptyCta')}
          </Link>
        }
      />
    );
  } else {
    body = (
      <ul aria-label={t('listLabel')} className="m-0 grid list-none gap-5 p-0">
        {subscriptions.map((sub) => {
          const live = sub.status === 'active' || sub.status === 'paused' || sub.status === 'failed';
          const mine = pending?.id === sub.id ? pending : null;
          const disabled = busy === sub.id;
          return (
            <li key={sub.id}>
              <Panel>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={TONE[sub.status]}>{t(`status.${sub.status}` as 'status.active')}</Badge>
                  {sub.orderNumber ? <span className="font-ui text-sm text-text-muted">{t('orderRef', { number: sub.orderNumber })}</span> : null}
                </div>
                <dl className="m-0 grid gap-2 font-ui text-sm text-text-body min-[43.75rem]:grid-cols-2">
                  <div>
                    <dt className="text-text-muted">{t('frequency')}</dt>
                    <dd className="m-0 font-medium text-text">{sub.frequency}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">{t('next')}</dt>
                    <dd className="m-0 font-medium text-text">{sub.status === 'active' && sub.nextOrderAt ? formatDate(sub.nextOrderAt, locale, timeZone) : t('nextNone')}</dd>
                  </div>
                </dl>
                {sub.skipPending > 0 ? <p className="m-0 font-ui text-sm text-text-muted">{t('skipPending')}</p> : null}
                <ul aria-label={t('items')} className="m-0 grid list-none gap-1 p-0 font-ui text-sm text-text-body">
                  {sub.lines.map((line, index) => (
                    <li key={`${line.name}-${index}`}>
                      {line.quantity} × {line.name}
                    </li>
                  ))}
                </ul>
                {sub.status === 'failed' ? (
                  <div role="alert" className="grid gap-2 rounded-sm bg-danger-50 p-3">
                    <p className="m-0 font-ui text-sm text-danger-600">{t('failedMessage')}</p>
                    <Link href={`/${store}/account/payment-methods`} className="inline-flex min-h-7 items-center font-utility text-sm text-text-link underline-offset-2 hover:underline">
                      {t('paymentLink')}
                    </Link>
                  </div>
                ) : null}
                {live && !mine ? (
                  <div className="flex flex-wrap gap-2">
                    {sub.status === 'active' ? (
                      <Button variant="secondary" disabled={disabled || sub.skipPending > 0} onClick={() => act(sub, 'skip')}>
                        {t('skip')}
                      </Button>
                    ) : null}
                    {sub.status === 'active' ? (
                      <Button variant="secondary" disabled={disabled} onClick={() => act(sub, 'pause')}>
                        {t('pause')}
                      </Button>
                    ) : null}
                    {sub.status === 'paused' || sub.status === 'failed' ? (
                      <Button variant="primary" disabled={disabled} onClick={() => act(sub, 'resume')}>
                        {t('resume')}
                      </Button>
                    ) : null}
                    {policies.length > 0 ? (
                      <Button variant="secondary" disabled={disabled} onClick={() => setPending({ id: sub.id, kind: 'choose', policyKey: sub.policyKey ?? policies[0].key })}>
                        {t('changeFrequency')}
                      </Button>
                    ) : null}
                    <Button variant="link" disabled={disabled} onClick={() => setPending({ id: sub.id, kind: 'cancel' })}>
                      {t('cancel')}
                    </Button>
                  </div>
                ) : null}
                {mine?.kind === 'cancel' ? (
                  <div role="group" aria-label={t('cancelConfirm')} className="grid gap-3">
                    <p className="m-0 font-ui text-sm text-text">{t('cancelConfirm')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={disabled} onClick={() => act(sub, 'cancel')}>
                        {t('cancelYes')}
                      </Button>
                      <Button variant="secondary" onClick={() => setPending(null)}>
                        {tc('cancel')}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {mine?.kind === 'choose' || mine?.kind === 'frequency' ? (
                  <div role="group" aria-label={t('changeFrequency')} className="grid gap-3">
                    <Select label={t('frequencySelect')} value={mine.policyKey} onChange={(e) => setPending({ id: sub.id, kind: 'choose', policyKey: e.target.value })}>
                      {policies.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                    {mine.kind === 'frequency' ? (
                      <>
                        <p className="m-0 font-ui text-sm text-text">{t('frequencyConfirm', { frequency: policies.find((p) => p.key === mine.policyKey)?.label ?? '' })}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={disabled} onClick={() => act(sub, 'change-frequency', mine.policyKey)}>
                            {tc('confirm')}
                          </Button>
                          <Button variant="secondary" onClick={() => setPending(null)}>
                            {tc('cancel')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setPending({ id: sub.id, kind: 'frequency', policyKey: mine.policyKey })}>{t('frequencyApply')}</Button>
                        <Button variant="secondary" onClick={() => setPending(null)}>
                          {tc('cancel')}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </Panel>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <Notice tone={message?.tone ?? 'success'}>{message?.text ?? null}</Notice>
      {body}
    </div>
  );
}
