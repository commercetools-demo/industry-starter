'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ApiError, fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { Link } from '@/i18n/routing';
import {
  CONTACT_TOPICS,
  FIELD_ORDER,
  LIMITS,
  validateContact,
  type ContactErrors,
  type ContactField,
} from '@/lib/contact/validate';
import { policyHref } from '@/lib/routes';

type Status = 'idle' | 'submitting' | 'sent' | 'failed';

interface Values {
  name: string;
  email: string;
  topic: string;
  orderNumber: string;
  message: string;
  consent: boolean;
  website: string;
}

const EMPTY: Values = { name: '', email: '', topic: '', orderNumber: '', message: '', consent: false, website: '' };

export interface ContactFormProps {
  locale: string;
  /** Static channel details for the market, shown when sending fails and in the confirmation. */
  channel: { email: string; phone: string | null; replyWithin: string };
}

/** The contact form. A confirmation appears only with the reference and channel the server returned. */
export default function ContactForm({ locale, channel }: ContactFormProps) {
  const t = useTranslations('contact');
  const { customer } = useAccount();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [rateLimited, setRateLimited] = useState(false);
  const [sent, setSent] = useState<{ reference: string; channel: string } | null>(null);
  const prefilled = useRef(false);

  // Prefill once, only into fields that are still empty; never overwrite what the shopper typed.
  useEffect(() => {
    if (!customer || prefilled.current) return;
    prefilled.current = true;
    setValues((v) => ({
      ...v,
      name: v.name || `${customer.firstName} ${customer.lastName}`.trim(),
      email: v.email || customer.email,
    }));
  }, [customer]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key as ContactField]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;
    const checked = validateContact(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = FIELD_ORDER.find((f) => checked.errors[f]);
      if (first) document.getElementById(`contact-${first}`)?.focus();
      return;
    }
    setErrors({});
    setRateLimited(false);
    setStatus('submitting');
    try {
      const res = await fetchJson<{ reference: string; channel: string }>('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, locale }),
        signal: AbortSignal.timeout(8000),
      });
      setSent({ reference: res.reference, channel: res.channel });
      setStatus('sent');
    } catch (e) {
      setRateLimited(e instanceof ApiError && e.status === 429);
      setStatus('failed');
    }
  }

  if (status === 'sent' && sent) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface p-6">
        <h2 className="m-0 mb-3 font-display text-[22px] font-semibold">{t('sent.title')}</h2>
        <p className="m-0 mb-1 font-mono text-[15px]">{t('sent.reference', { reference: sent.reference })}</p>
        <p className="m-0 mb-1 text-ink-2">{t('sent.channel', { channel: sent.channel })}</p>
        <p className="m-0 text-ink-2">{t('sent.reply', { replyWithin: channel.replyWithin })}</p>
      </div>
    );
  }

  const submitting = status === 'submitting';
  // "I have read the {link}." with the link element placed where the placeholder is.
  const consentParts = String(t.raw('consent')).split('{link}');
  const describedBy = (id: string) => (errors[id.replace('contact-', '') as ContactField] ? `${id}-error` : undefined);
  const err = (f: ContactField) => (errors[f] ? t(`error.${errors[f]}`) : undefined);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting || undefined} className="rounded-card border border-line bg-surface p-6">
      <h2 className="m-0 mb-4 font-display text-[22px] font-semibold">{t('title')}</h2>

      <Field label={t('field.name')} htmlFor="contact-name" error={err('name')}>
        <Input id="contact-name" name="name" autoComplete="name" value={values.name} invalid={!!errors.name} aria-describedby={describedBy('contact-name')} onChange={(e) => set('name', e.target.value)} />
      </Field>

      <Field label={t('field.email')} htmlFor="contact-email" error={err('email')}>
        <Input id="contact-email" name="email" type="email" autoComplete="email" value={values.email} invalid={!!errors.email} aria-describedby={describedBy('contact-email')} onChange={(e) => set('email', e.target.value)} />
      </Field>

      <Field label={t('field.topic')} htmlFor="contact-topic" error={err('topic')}>
        <Select id="contact-topic" name="topic" value={values.topic} invalid={!!errors.topic} aria-describedby={describedBy('contact-topic')} onChange={(e) => set('topic', e.target.value)}>
          <option value="" disabled>
            {t('topic.choose')}
          </option>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {t(`topic.${topic}`)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('field.orderNumber')} htmlFor="contact-orderNumber" error={err('orderNumber')}>
        <Input id="contact-orderNumber" name="orderNumber" autoComplete="off" value={values.orderNumber} invalid={!!errors.orderNumber} aria-describedby={describedBy('contact-orderNumber')} onChange={(e) => set('orderNumber', e.target.value)} />
      </Field>

      <Field label={t('field.message')} htmlFor="contact-message" error={err('message')}>
        <p id="contact-message-hint" className="m-0 mb-1.5 text-[12.5px] text-ink-2">
          {t('noSecrets')}
        </p>
        <Textarea id="contact-message" name="message" rows={6} value={values.message} invalid={!!errors.message} aria-describedby={(errors.message ? 'contact-message-error' : 'contact-message-hint')} onChange={(e) => set('message', e.target.value)} />
        <p className="m-0 mt-1 text-right text-[12.5px] text-ink-2" aria-hidden="true">
          {t('counter', { count: values.message.length, max: LIMITS.message.max })}
        </p>
      </Field>

      {/* Honeypot: invisible, not focusable, not announced. A person never fills it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">{t('field.website')}</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set('website', e.target.value)} />
      </div>

      <div className="mb-5">
        <div className="flex items-start gap-3">
          <input
            id="contact-consent"
            name="consent"
            type="checkbox"
            checked={values.consent}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={describedBy('contact-consent')}
            onChange={(e) => set('consent', e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-accent"
          />
          <label htmlFor="contact-consent" className="text-[14px] text-ink-2">
            {consentParts[0]}
            <Link href={policyHref('privacy')} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-accent">
              {t('privacyLink')}
            </Link>
            {consentParts[1]}
          </label>
        </div>
        {errors.consent ? (
          <p id="contact-consent-error" className="mt-1.5 text-[12.5px] font-medium text-danger-text">
            {t('error.consentRequired')}
          </p>
        ) : null}
      </div>

      {status === 'failed' ? (
        <p role="alert" className="mb-4 rounded-field border border-danger p-3 text-[14px] text-danger-text">
          {channel.phone ? t('failed', { email: channel.email, phone: channel.phone }) : t('failedNoPhone', { email: channel.email })}
          {rateLimited ? ` ${t('failedRate')}` : ''}
        </p>
      ) : null}

      <Button type="submit" variant="ink" size="lg" loading={submitting} block>
        {submitting ? t('sending') : t('submit')}
      </Button>
    </form>
  );
}
