'use client';

import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

export interface CheckoutStep {
  id: 1 | 2;
  label: string;
}

/**
 * Two steps, Review then Pay. The step behind you is a button (back to Review: the hosted widget unmounts and the next Continue
 * creates a new session); the step ahead is not focusable (`aria-disabled`). `aria-current="step"` marks the active one.
 */
export default function StepIndicator({
  steps, current, onGoTo,
}: {
  steps: CheckoutStep[];
  current: 1 | 2;
  onGoTo: (id: 1 | 2) => void;
}) {
  const t = useTranslations('checkout');
  return (
    <nav aria-label={t('stepsLabel')}>
      <ol className="m-0 flex list-none items-center gap-2.5 p-0">
        {steps.map((step, index) => {
          const state = step.id < current ? 'done' : step.id === current ? 'active' : 'pending';
          const circle = (
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-pill border-[1.5px] text-[12px]',
                state === 'done' && 'border-teal-strong bg-teal-strong text-surface',
                state === 'active' && 'border-ink bg-ink text-surface',
                state === 'pending' && 'border-line-2',
              )}
            >
              {state === 'done' ? <Icon name="check" size={14} /> : step.id}
            </span>
          );
          return (
            <Fragment key={step.id}>
              {index > 0 ? <li aria-hidden="true" className="h-px w-7 bg-line-2" /> : null}
              <li data-state={state} {...(state === 'active' ? { 'aria-current': 'step' as const } : {})}>
                {state === 'done' ? (
                  <button
                    type="button"
                    onClick={() => onGoTo(step.id)}
                    className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13px] font-semibold text-ink"
                  >
                    {circle}
                    {step.label}
                  </button>
                ) : (
                  <span
                    {...(state === 'pending' ? { 'aria-disabled': true as const } : {})}
                    className={cn('flex items-center gap-2 text-[13px] font-semibold', state === 'pending' ? 'text-ink-3' : 'text-ink')}
                  >
                    {circle}
                    {step.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
