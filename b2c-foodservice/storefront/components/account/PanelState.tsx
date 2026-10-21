'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export interface PanelStateProps {
  /** Panel name used in "{panel} is unavailable right now." */
  panel: string;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  /** Explicit empty state, never a blank panel. */
  empty: ReactNode;
  children: ReactNode;
}

/** Loading skeleton, error with Retry, or the explicit empty state; otherwise the panel. Never hides another panel. */
export default function PanelState({ panel, isLoading, isError, isEmpty, onRetry, empty, children }: PanelStateProps) {
  const t = useTranslations('account.panel');
  if (isLoading) {
    return (
      <div role="status" aria-label={t('loading')} data-testid="panel-loading" className="grid gap-3">
        <div className="h-24 animate-pulse rounded-card bg-canvas-2" />
        <div className="h-24 animate-pulse rounded-card bg-canvas-2" />
      </div>
    );
  }
  if (isError) {
    return (
      <Card data-testid="panel-error" role="alert">
        <p className="m-0 mb-3 text-[14.5px] text-ink-2">{t('unavailable', { panel })}</p>
        <Button variant="ghost" onClick={onRetry}>
          {t('retry')}
        </Button>
      </Card>
    );
  }
  if (isEmpty) return <Card data-testid="panel-empty">{empty}</Card>;
  return <>{children}</>;
}
