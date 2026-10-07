'use client';

import { useState, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BroadbandLabel } from '@/components/label/BroadbandLabel';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { FOCUS_RING } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import { QUANTITY_RULES } from '@/lib/config/cart';
import type { CartLine, Locale } from '@/lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { PriceSchedule } from './PriceSchedule';

type PlanCardProps = {
  line: CartLine;
  /** Add-ons and equipment that go with this plan (D-026): removing the plan asks first when there are any. */
  dependents: CartLine[];
  busy?: boolean;
  onQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string, cascade: boolean) => void;
};

const KIND_KEY = (line: CartLine): 'phone' | 'cable' | 'wireless' => (line.family === 'phone' ? 'phone' : line.technology === 'cable' ? 'cable' : 'wireless');

/** A plan of the bundle: honey header (kind, name, monthly price), highlights, term, the month-by-month schedule and its Broadband Facts label. */
export function PlanCard({ line, dependents, busy = false, onQuantity, onRemove }: PlanCardProps): ReactElement {
  const t = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const [confirming, setConfirming] = useState(false);
  const isPhone = line.family === 'phone';
  const validity = line.termMonths > 0 ? t('line.term', { months: line.termMonths }) : t('line.monthToMonth');

  return (
    <Card as="article">
      <CardHeader tone="brand" className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="font-display text-xs font-semibold tracking-ui">{t(`kind.${KIND_KEY(line)}`)}</div>
          <h3 className="m-0 font-display text-3xl font-bold tracking-ui">{line.name}</h3>
        </div>
        <div className="font-display text-3xl font-bold">
          {t('line.perMonth', { amount: formatMoneyExact(line.unitPrice, locale) })}
        </div>
      </CardHeader>
      <CardBody className="flex-row flex-wrap gap-7">
        <div className="flex min-w-56 flex-1 flex-col gap-5">
          {line.bullets.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {line.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-md leading-snug">
                  <span aria-hidden="true" className="text-pink-700">
                    ▸
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="border-t border-border pt-4 text-sm text-text-muted">{validity}</div>
          {isPhone ? (
            <QuantityStepper
              value={line.quantity}
              min={QUANTITY_RULES.plan_phone.min}
              max={QUANTITY_RULES.plan_phone.max}
              onChange={(value) => onQuantity(line.id, value)}
              decreaseLabel={t('qty.decrease')}
              increaseLabel={t('qty.increase')}
              valueLabel={t('qty.label')}
              className={busy ? 'pointer-events-none opacity-60' : undefined}
            />
          ) : null}
          {line.schedule ? <PriceSchedule schedule={line.schedule} locale={locale} /> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => (dependents.length > 0 ? setConfirming(true) : onRemove(line.id, false))}
            className={cx('self-start rounded-pill bg-transparent p-0 font-display text-sm font-semibold tracking-ui text-text underline underline-offset-4', FOCUS_RING)}
          >
            {t('line.removePlan')}
          </button>
        </div>
        {line.label ? (
          <div className="w-full max-w-full md:w-auto">
            <BroadbandLabel label={line.label} />
          </div>
        ) : null}
      </CardBody>
      <ConfirmDialog
        open={confirming}
        title={t('removeDependents.title', { name: line.name })}
        confirmLabel={t('removeDependents.confirm')}
        cancelLabel={t('removeDependents.cancel')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove(line.id, true);
        }}
      >
        <p className="m-0">{t('removeDependents.body', { items: dependents.map((dependent) => dependent.name).join(', ') })}</p>
      </ConfirmDialog>
    </Card>
  );
}
