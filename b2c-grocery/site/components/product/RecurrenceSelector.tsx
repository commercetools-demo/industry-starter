'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/Segmented';
import type { Product, Variant } from '@/lib/types';

/** `''` is the one-time purchase; any other value is a recurrence policy key. */
export const ONE_TIME = '';

export type RecurrenceOption = { key: string; name: string };

/**
 * "Repeat" selector of the buy box (workstream W). `policies` come from the server page: it passes an empty list when
 * `FEATURE_SUBSCRIPTIONS` is off, so the flag never reaches the client as an env var. Nothing is shown for a product
 * that is not recurring-eligible. A cadence other than "One-time" shows the plain-words price notice.
 */
export function RecurrenceSelector({
  product,
  variant,
  policies = [],
  value = ONE_TIME,
  onChange,
}: {
  product: Product;
  variant: Variant;
  policies?: RecurrenceOption[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  void variant;
  const t = useTranslations('subscription');
  const noticeId = useId();
  if (!product.recurringEligible || policies.length === 0) return null;
  return (
    <div className="mb-(--space-3)" data-testid="recurrence-selector">
      <div className="card-meta mb-(--space-2)">{t('repeatLabel')}</div>
      <Segmented
        label={t('repeatLabel')}
        value={value}
        onChange={(next) => onChange?.(next)}
        options={[{ value: ONE_TIME, label: t('oneTime') }, ...policies.map((p) => ({ value: p.key, label: p.name }))]}
      />
      {value !== ONE_TIME ? (
        <p id={noticeId} role="note" className="mt-(--space-2) mb-0 text-[14px] text-text/75">
          {t('priceNotice')}
        </p>
      ) : null}
    </div>
  );
}
