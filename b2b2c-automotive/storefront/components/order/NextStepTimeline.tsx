// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import type { OrderTimeline } from '@/lib/types';

const DOT: Record<string, string> = {
  done: 'border-success-600 bg-success-600 text-text-on-brand',
  current: 'border-action bg-action text-text-on-brand',
  upcoming: 'border-border-strong bg-surface text-text-muted',
};

/** The steps of the order as an ordered list; the current one carries `aria-current="step"` and a visually hidden label. */
export function NextStepTimeline({ timeline }: { timeline: OrderTimeline }) {
  const t = useTranslations('order.timeline');
  if (timeline.steps.length === 0) return null;
  return (
    <section aria-labelledby="order-timeline-title" className="grid gap-3">
      <h2 id="order-timeline-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      <ol className="m-0 grid list-none gap-3 p-0">
        {timeline.steps.map((step, index) => (
          <li key={step.key} aria-current={step.state === 'current' ? 'step' : undefined} data-state={step.state} className="flex items-center gap-3 font-ui text-sm">
            <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${DOT[step.state]}`}>
              {index + 1}
            </span>
            <span className={step.state === 'upcoming' ? 'text-text-muted' : 'font-medium text-text'}>
              {t(step.key)}
              {step.state === 'current' ? <span className="sr-only"> ({t('currentStep')})</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
