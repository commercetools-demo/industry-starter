'use client';

import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import Icon from './Icon';

export interface StepsProps {
  steps: Array<{ key: string; label: string }>;
  /** The `key` of the active step; earlier steps are done, later ones pending. */
  current: string;
}

export default function Steps({ steps, current }: StepsProps) {
  const t = useTranslations('ui.steps');
  const activeIndex = steps.findIndex((s) => s.key === current);
  return (
    <ol className="m-0 flex list-none items-center gap-2.5 p-0">
      {steps.map((step, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
        return (
          <Fragment key={step.key}>
            {index > 0 ? <li aria-hidden="true" className="h-px w-7 bg-line-2" /> : null}
            <li
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 text-[13px] font-semibold',
                state === 'pending' ? 'text-ink-3' : 'text-ink',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-pill border-[1.5px] text-[12px]',
                  state === 'done' && 'border-teal-strong bg-teal-strong text-surface',
                  state === 'active' && 'border-ink bg-ink text-surface',
                  state === 'pending' && 'border-line-2',
                )}
              >
                {state === 'done' ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <span>{step.label}</span>
              {state === 'done' ? <span className="sr-only">{t('done')}</span> : null}
              {state === 'active' ? <span className="sr-only">{t('current')}</span> : null}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
