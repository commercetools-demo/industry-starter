// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useDevComplete } from '@/hooks/useDevComplete';

/** DEV ONLY (O-08). The page renders it only when the server says the helper is on (never in production). It makes an order without a payment. */
export function DevCompletePanel({ navigate }: { navigate?: (path: string) => void }) {
  const t = useTranslations('checkout.dev');
  const [email, setEmail] = useState('qa-1@example.com');
  const { complete, pending, failed } = useDevComplete(navigate);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void complete(email);
  };
  return (
    <form onSubmit={onSubmit} aria-labelledby="checkout-dev-title" className="grid gap-3 rounded-md border border-dashed border-border-strong bg-surface-subtle p-4">
      <h2 id="checkout-dev-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      <p className="m-0 font-ui text-sm text-text-muted">{t('description')}</p>
      <Field label={t('emailLabel')} type="email" name="customerEmail" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
      {failed ? (
        <p role="alert" className="m-0 font-ui text-sm text-danger-600">
          {t('failed')}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
