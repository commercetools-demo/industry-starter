import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import type { CheckoutStep } from '@/lib/types';

// Junior design choice (D-068): numbered pills in a row; the current step is filled, earlier steps are marked done, later ones muted.

export function CheckoutStepper({ steps, current }: { steps: CheckoutStep[]; current: CheckoutStep }): ReactElement {
  const t = useTranslations('checkout');
  const index = steps.indexOf(current);
  return (
    <ol aria-label={t('stepsLabel')} className="m-0 flex list-none flex-wrap gap-3 p-0">
      {steps.map((step, position) => (
        <li
          key={step}
          aria-current={step === current ? 'step' : undefined}
          className={cx(
            'flex items-center gap-3 rounded-pill px-4 py-2 font-display text-sm font-semibold',
            step === current ? 'bg-brand-950 text-text-on-pink' : position < index ? 'bg-brand-100 text-brand-950' : 'bg-neutral-100 text-text-muted',
          )}
        >
          <span aria-hidden="true">{position + 1}</span>
          <span>{t(`step.${step}`)}</span>
        </li>
      ))}
    </ol>
  );
}
