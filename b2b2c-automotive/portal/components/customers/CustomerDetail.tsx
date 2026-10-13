'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { StatusChip } from '@/components/returns/StatusChip';
import { Chip } from '@/components/portal/Chip';
import { buttonPrimary, buttonSecondary, buttonSmall, errorNote, hintClass, infoNote, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { customerApi, useCustomerDetail } from '@/hooks/vApi';
import { Link, useRouter } from '@/i18n/routing';
import { money, shortDate } from '@/lib/v-format';
import { NOTE_LIMIT } from './limits';

const textareaClass =
  'min-h-3200 w-full rounded-300 border border-border-input bg-bg-surface px-300 py-250 text-body-2 font-medium text-text placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';

/** Posts the handoff token in a form body to the storefront in a new tab: the token is never part of a URL. */
function submitHandoff(action: string, token: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = '_blank';
  form.rel = 'noopener';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token';
  input.value = token;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-300 rounded-200 bg-bg-surface p-500 shadow-card">
      <h2 className="text-title-1 font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

/** Customer detail (V-05): orders with "Mark delivered", garage, consent, subscriptions, returns, notes, and "Shop as customer". */
export function CustomerDetail({ id }: { id: string }) {
  const t = useTranslations('customers');
  const ts = useTranslations('subscriptions');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { storeKey } = useViewer();
  const { data, error, mutate } = useCustomerDetail(storeKey, id, locale);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) {
    return (
      <p role="alert" className={errorNote}>
        {t('detail.error')}
      </p>
    );
  }
  if (!data) {
    return (
      <p role="status" className={infoNote}>
        {t('detail.loading')}
      </p>
    );
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setProblem('');
    const result = await customerApi.addNote(storeKey, id, note);
    setBusy(false);
    if (!result.ok) return setProblem(result.status === 403 ? t('errors.forbidden') : t('errors.generic'));
    setNote('');
    toast(t('detail.notes.saved'));
    void mutate();
  }

  async function markDelivered(orderNumber: string) {
    const result = await customerApi.markDelivered(storeKey, orderNumber);
    if (!result.ok) return setProblem(t('errors.generic'));
    toast(t('detail.orders.marked', { number: orderNumber }));
    void mutate();
  }

  async function shopAs() {
    setProblem('');
    const result = await customerApi.shopAs(storeKey, id);
    if (!result.ok || !result.data) return setProblem(result.code === 'NOT_CONFIGURED' ? t('detail.shopAs.notConfigured') : t('detail.shopAs.failed'));
    toast(t('detail.shopAs.started', { name: data?.name ?? '' }));
    submitHandoff(result.data.action, result.data.token);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-400">
      <div className="flex flex-wrap items-center justify-between gap-300">
        <Link href="/customers" className="text-body-2 font-semibold text-text underline focus-visible:outline-2 focus-visible:outline-border-active">
          {t('detail.back')}
        </Link>
        <div className="flex flex-col items-end gap-100">
          <button type="button" className={buttonPrimary} onClick={() => void shopAs()}>
            {t('detail.shopAs.button')}
          </button>
          <p className={hintClass}>{t('detail.shopAs.hint')}</p>
        </div>
      </div>
      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}

      <Section title={data.name}>
        <dl className="grid grid-cols-1 gap-300 text-body-2 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-text-subdued">{t('detail.email')}</dt>
            <dd data-testid="customer-email">{data.email}</dd>
          </div>
          {data.mobile ? (
            <div>
              <dt className="font-semibold text-text-subdued">{t('detail.mobile')}</dt>
              <dd>{data.mobile}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold text-text-subdued">{t('detail.since')}</dt>
            <dd>{shortDate(data.createdAt, locale)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-subdued">{t('detail.consent')}</dt>
            <dd>{data.marketingConsent === null ? t('detail.consentUnknown') : data.marketingConsent ? t('detail.consentYes', { date: shortDate(data.marketingConsentAt, locale) }) : t('detail.consentNo')}</dd>
          </div>
        </dl>
      </Section>

      <Section title={t('detail.orders.title')}>
        {data.orders.length === 0 ? (
          <p className={infoNote}>{t('detail.orders.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[calc(var(--space-6400)*2)] border-collapse">
              <caption className="sr-only">{t('detail.orders.title')}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={thClass}>{t('detail.orders.number')}</th>
                  <th scope="col" className={thClass}>{t('detail.orders.date')}</th>
                  <th scope="col" className={`${thClass} text-right`}>{t('detail.orders.total')}</th>
                  <th scope="col" className={thClass}>{t('detail.orders.delivered')}</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-semibold`}>{order.orderNumber}</td>
                    <td className={tdClass}>{shortDate(order.createdAt, locale)}</td>
                    <td className={`${tdClass} text-right`}>{money(order.totalCents, order.currency, locale)}</td>
                    <td className={tdClass}>
                      {order.deliveredAt ? (
                        <Chip tone="success">{shortDate(order.deliveredAt, locale)}</Chip>
                      ) : (
                        <span className="inline-flex flex-wrap items-center gap-200">
                          <Chip tone="neutral">{t('detail.orders.notDelivered')}</Chip>
                          <button type="button" className={buttonSmall} onClick={() => void markDelivered(order.orderNumber)}>
                            {t('detail.orders.markDelivered')}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={t('detail.garage.title')}>
        {data.garage.length === 0 ? (
          <p className={infoNote}>{t('detail.garage.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-150 text-body-2">
            {data.garage.map((v) => (
              <li key={v.id}>{v.label}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('detail.subscriptions.title')}>
        {data.subscriptions.length === 0 ? (
          <p className={infoNote}>{t('detail.subscriptions.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-150 text-body-2">
            {data.subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-200">
                <span>{s.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</span>
                <Chip tone={s.status === 'Active' ? 'success' : s.status === 'Paused' ? 'warning' : 'neutral'}>{ts(`status.${s.status}`)}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('detail.returns.title')}>
        {data.returns.length === 0 ? (
          <p className={infoNote}>{t('detail.returns.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-150 text-body-2">
            {data.returns.map((r) => (
              <li key={r.returnNumber} className="flex flex-wrap items-center gap-200">
                <span className="font-semibold">{r.returnNumber}</span>
                <StatusChip status={r.status} refundState={r.refundState} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('detail.notes.title')}>
        {data.notes.length === 0 ? (
          <p className={infoNote}>{t('detail.notes.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-200 text-body-2">
            {data.notes.map((n) => (
              <li key={`${n.at}-${n.text}`} className="flex flex-col">
                <span>{n.text}</span>
                <span className="text-caption-1 text-text-subdued">{shortDate(n.at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addNote} className="flex flex-col gap-200">
          <label htmlFor="customer-note" className="text-body-2 font-semibold text-text">
            {t('detail.notes.label')}
          </label>
          <textarea id="customer-note" className={textareaClass} maxLength={NOTE_LIMIT} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className={hintClass}>{t('detail.notes.hint')}</p>
          <div>
            <button type="submit" className={buttonSecondary} disabled={busy || !note.trim()}>
              {t('detail.notes.add')}
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
