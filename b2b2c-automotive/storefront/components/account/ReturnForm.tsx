// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import { Notice, Panel } from '@/components/account/Panel';
import { buttonClass, Button } from '@/components/ui/Button';
import { INPUT_CLASS } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { errorCodeOf } from '@/hooks/account-fetch';
import { useOrderActions } from '@/hooks/useOrderActions';
import { Link, useRouter } from '@/i18n/routing';
import { formatDate } from '@/lib/account/format';
import { RETURN_REASONS } from '@/lib/contracts/return-item';

interface Props {
  store: string;
  orderNumber: string;
  /** Lines with units left to return (zero-remaining lines are not offered). */
  lines: Array<{ lineItemId: string; name: string; remaining: number }>;
  /** Last day a return may be requested (ISO). */
  deadline: string | null;
  timeZone: string;
}

/** Choose the parts, the quantities and a reason; the confirmation shows the tracking reference. Errors are the server's refusals in words. */
export function ReturnForm({ store, orderNumber, lines, deadline, timeZone }: Props) {
  const t = useTranslations('account.return');
  const locale = useLocale();
  const router = useRouter();
  const { requestReturn } = useOrderActions();
  const offered = lines.filter((l) => l.remaining > 0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const base = `/${store}/account/orders/${orderNumber}`;

  function toggle(id: string, checked: boolean) {
    setSelected((s) => {
      const next = { ...s };
      if (checked) next[id] = 1;
      else delete next[id];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const items = Object.entries(selected).map(([lineItemId, quantity]) => ({ lineItemId, quantity }));
    const problem = items.length === 0 ? t('needLine') : reason === '' ? t('needReason') : null;
    if (problem) {
      setError(problem);
      errorRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await requestReturn(orderNumber, { items, reason, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      setTracking(result.tracking);
      router.refresh();
    } catch (failure) {
      const code = errorCodeOf(failure);
      setError(t(`errors.${code in ERROR_CODES ? code : 'generic'}` as 'errors.generic'));
    }
    setPending(false);
  }

  if (tracking) {
    return (
      <Panel>
        <p role="status" className="m-0 font-display text-lg font-semibold text-success-600">
          {t('success', { tracking })}
        </p>
        <p className="m-0 font-ui text-sm text-text-body">{t('successBody')}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/${store}/account/returns`} className={buttonClass('primary')}>
            {t('viewReturns')}
          </Link>
          <Link href={base} className={buttonClass('secondary')}>
            {t('backToOrder')}
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="m-0 font-ui text-sm text-text-body">{t('intro', { number: orderNumber, date: formatDate(deadline, locale, timeZone) })}</p>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <fieldset className="m-0 grid gap-3 border-0 p-0">
          <legend className="mb-2 font-ui text-xs font-bold uppercase tracking-label text-text-muted">{t('linesLegend')}</legend>
          {offered.map((line) => {
            const checked = line.lineItemId in selected;
            return (
              <div key={line.lineItemId} className="flex flex-wrap items-center gap-3 rounded-sm border border-border p-3">
                <label className="flex min-h-7 flex-1 items-center gap-3 font-ui text-sm text-text">
                  <input type="checkbox" checked={checked} onChange={(e) => toggle(line.lineItemId, e.target.checked)} aria-label={t('include', { name: line.name })} className="size-5 accent-action" />
                  <span>{line.name}</span>
                </label>
                {checked ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={line.remaining}
                      value={selected[line.lineItemId]}
                      aria-label={t('quantity', { name: line.name })}
                      onChange={(e) => setSelected((s) => ({ ...s, [line.lineItemId]: Math.min(line.remaining, Math.max(1, Number(e.target.value) || 1)) }))}
                      className={`${INPUT_CLASS} w-7`}
                    />
                    <span className="font-ui text-sm text-text-muted">{t('of', { count: line.remaining })}</span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </fieldset>
        <Select label={t('reason')} value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">{t('reasonPlaceholder')}</option>
          {RETURN_REASONS.map((code) => (
            <option key={code} value={code}>
              {t(`reasons.${code}` as 'reasons.other')}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1">
          <label htmlFor="return-comment" className="font-ui text-xs font-bold uppercase tracking-label text-text-muted">
            {t('comment')}
          </label>
          <textarea id="return-comment" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} className={`${INPUT_CLASS} py-3`} />
        </div>
        <div ref={errorRef} tabIndex={-1}>
          <Notice tone="error">{error}</Notice>
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

const ERROR_CODES: Record<string, true> = {
  NOT_DELIVERED: true,
  RETURN_WINDOW_CLOSED: true,
  NOTHING_LEFT: true,
  'quantity-exceeds': true,
  'invalid-line': true,
  'invalid-reason': true,
  'no-items': true,
  'return-refused': true,
};
