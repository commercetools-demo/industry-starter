'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { RadioCard } from '@/components/ui/Inputs';
import type { MethodChangeResult } from '@/hooks/use-checkout';
import { SAME_DAY_METHOD_KEY } from '@/lib/checkout/config';
import { formatMoney } from '@/lib/utils';
import type { DeliveryOption } from '@/lib/types';

const KNOWN_KEYS: readonly string[] = ['mlv-standard', 'mlv-same-day'];

export interface DeliverySpeedCardProps {
  /** Options the platform returned for the cart's address (matching-cart), with the cut-off applied by the server. */
  options: DeliveryOption[];
  /** Key of the method on the cart. */
  selectedKey: string | null;
  /** The cart has a full address (without one there are no options to show). */
  hasAddress: boolean;
  onChoose: (key: string) => Promise<MethodChangeResult>;
}

/**
 * Delivery speed as radio cards from the platform's options (never a list built in the browser). The selected card
 * has the azure border (`RadioCard`). When same-day is not among the options (after the 2 pm Eastern cut-off, or an
 * address outside NY/TX/IL) it is not offered and a note says why. A change goes to the server; the summary shows
 * the recalculated cart.
 */
export function DeliverySpeedCard({ options, selectedKey, hasAddress, onChoose }: DeliverySpeedCardProps) {
  const t = useTranslations('checkout.delivery');
  const locale = useLocale();
  const [pending, setPending] = useState<string | null>(null);
  const [problem, setProblem] = useState<'unavailable' | 'failed' | null>(null);

  async function choose(key: string) {
    if (pending || key === selectedKey) return;
    setPending(key);
    setProblem(null);
    const result = await onChoose(key);
    setPending(null);
    if (!result.ok) setProblem(result.reason === 'unavailable' ? 'unavailable' : 'failed');
  }

  const label = (option: DeliveryOption) => (KNOWN_KEYS.includes(option.key) ? t(`methods.${option.key}` as 'methods.mlv-standard') : option.name);
  const price = (option: DeliveryOption) => (option.price.centAmount === 0 ? t('free') : formatMoney(option.price.centAmount, option.price.currencyCode, locale));
  const sameDayMissing = hasAddress && options.length > 0 && !options.some((o) => o.key === SAME_DAY_METHOD_KEY);

  return (
    <Card as="section" aria-labelledby="checkout-delivery-title" className="grid gap-4" data-checkout-card="delivery">
      <h2 id="checkout-delivery-title" className="font-display text-xl font-semibold text-navy-900">
        {t('title')}
      </h2>
      {!hasAddress ? (
        <p className="text-sm text-neutral-600" data-delivery-need-address>
          {t('needAddress')}
        </p>
      ) : options.length === 0 ? (
        <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700" data-delivery-none>
          {t('none')}
        </p>
      ) : (
        <fieldset className="grid gap-3" aria-busy={pending !== null || undefined}>
          <legend className="sr-only">{t('title')}</legend>
          {options.map((option) => (
            <RadioCard
              key={option.key}
              name="delivery-method"
              value={option.key}
              label={label(option)}
              detail={price(option)}
              checked={option.key === selectedKey}
              disabled={pending !== null}
              onChange={() => void choose(option.key)}
              data-delivery-option={option.key}
            />
          ))}
        </fieldset>
      )}
      {sameDayMissing ? (
        <p className="text-sm text-neutral-600" data-same-day-unavailable>
          {t('sameDayUnavailable')}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {problem === 'unavailable' ? t('unavailable') : t('changeFailed')}
        </p>
      ) : null}
    </Card>
  );
}
