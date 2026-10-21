'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/context/toast';
import { fetchJson } from '@/hooks/fetcher';
import { isValidEmail } from '@/lib/newsletter';

/** Footer sign-up: validates inline, posts to the validated no-op route, confirms with the toast. */
export default function NewsletterForm() {
  const t = useTranslations('shell.newsletter');
  const toast = useToast();
  const id = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!isValidEmail(value)) {
      setError(t('invalid'));
      return;
    }
    setError(null);
    setPending(true);
    try {
      await fetchJson('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      setEmail('');
      toast.show(t('success'));
    } catch {
      setError(t('error'));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 max-w-[420px]">
      <p className="m-0 mb-2.5 font-display text-[15px] font-semibold text-surface">{t('heading')}</p>
      <label htmlFor={id} className="sr-only">
        {t('label')}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          shape="pill"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholder')}
          invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant="accent" loading={pending}>
          {t('join')}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[13px] font-medium text-footer-link">
          {error}
        </p>
      ) : null}
    </form>
  );
}
