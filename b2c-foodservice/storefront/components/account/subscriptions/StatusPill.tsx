'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { SubscriptionState } from '@/lib/types';

const TONE: Record<SubscriptionState, string> = {
  active: 'bg-accent/10 text-accent-press',
  paused: 'bg-canvas-2 text-ink-2',
  canceled: 'bg-canvas-2 text-ink-2',
  expired: 'bg-canvas-2 text-ink-2',
  failed: 'bg-canvas-2 text-danger-text',
};

/** The state in words (never colour only): Active, Paused, Canceled, Expired, Needs attention. */
export default function StatusPill({ state }: { state: SubscriptionState }) {
  const t = useTranslations('subscription.status');
  return (
    <span data-testid="subscription-status" data-state={state} className={cn('inline-flex items-center rounded-pill px-2.5 py-0.5 text-[12px] font-semibold', TONE[state])}>
      {t(state)}
    </span>
  );
}
