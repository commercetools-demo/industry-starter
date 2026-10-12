'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { WidgetError } from './WidgetError';

export type WidgetStatus = 'loading' | 'error' | 'ok';

/** White widget card: title, loading skeleton, error slot or the body. A failure is contained here and never reaches a sibling. */
export function WidgetCard({
  testId,
  title,
  action,
  status,
  errorTitle,
  errorMessage,
  onRetry,
  children,
}: {
  testId: string;
  title: string;
  action?: ReactNode;
  status: WidgetStatus;
  errorTitle: string;
  errorMessage: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('dashboard');
  return (
    <section data-testid={testId} aria-label={title} className="flex h-full flex-col gap-400 rounded-200 bg-bg-surface p-600 shadow-card narrow:p-400">
      <header className="flex items-center justify-between gap-300">
        <h2 className="text-title-2 font-semibold text-text">{title}</h2>
        {action}
      </header>
      {status === 'loading' ? (
        <div role="status" aria-label={t('loading')} data-testid="widget-loading" className="flex flex-col gap-300">
          <div className="h-400 w-full rounded-100 bg-bg-surface-subdued motion-safe:animate-pulse" />
          <div className="h-400 w-3/4 rounded-100 bg-bg-surface-subdued motion-safe:animate-pulse" />
          <div className="h-400 w-1/2 rounded-100 bg-bg-surface-subdued motion-safe:animate-pulse" />
        </div>
      ) : status === 'error' ? (
        <WidgetError title={errorTitle} message={errorMessage} onRetry={onRetry} />
      ) : (
        children
      )}
    </section>
  );
}

export const statusOf = (s: { data: unknown; error: unknown; isLoading: boolean }): WidgetStatus => (s.error ? 'error' : s.data === undefined || s.isLoading ? 'loading' : 'ok');
