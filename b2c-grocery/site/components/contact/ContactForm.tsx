'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { useContact } from '@/hooks/useContact';
import { CONTACT_TOPICS, MESSAGE_MAX, validateContact, type ContactErrors } from '@/lib/contact-validation';

/** Contact form. Validates with the shared rules before posting; the server validates again. */
export function ContactForm() {
  const t = useTranslations('static.contact');
  const { submit, isPending } = useContact();
  const [errors, setErrors] = useState<ContactErrors>({});
  const [formError, setFormError] = useState<'rateLimited' | 'failed' | null>(null);
  const [sent, setSent] = useState(false);

  const message = (code?: string) => (code ? t(`errors.${code}`) : undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => (typeof data.get(key) === 'string' ? (data.get(key) as string) : '');
    const payload = { name: get('name'), email: get('email'), topic: get('topic'), message: get('message'), website: get('website') };

    // The honeypot goes to the server untouched; bots get the same confirmation.
    const check = payload.website ? { ok: true as const } : validateContact(payload);
    if (!check.ok) {
      setErrors(check.errors);
      setFormError(null);
      return;
    }
    setErrors({});
    setFormError(null);
    const result = await submit(payload);
    if (result.ok) setSent(true);
    else if (result.reason === 'validation') setErrors(result.fields);
    else setFormError(result.reason);
  }

  if (sent) {
    return (
      <div role="status" className="max-w-[720px]">
        <h2>{t('successTitle')}</h2>
        <p>{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-[720px] flex-col gap-(--space-4)">
      <Input label={t('name')} name="name" autoComplete="name" maxLength={100} error={message(errors.name)} />
      <Input label={t('email')} name="email" type="email" autoComplete="email" error={message(errors.email)} />
      <Select label={t('topic')} name="topic" defaultValue="" error={message(errors.topic)}>
        <option value="" disabled>
          {t('topicPlaceholder')}
        </option>
        {CONTACT_TOPICS.map((topic) => (
          <option key={topic} value={topic}>
            {t(`topics.${topic}`)}
          </option>
        ))}
      </Select>
      <Textarea label={t('message')} name="message" rows={6} maxLength={MESSAGE_MAX} error={message(errors.message)} />
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {formError ? (
        <p role="alert" className="m-0 text-accent-700">
          {t(`formErrors.${formError}`)}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('sending') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
