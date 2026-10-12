'use client';

import { useTranslations } from 'next-intl';

/** Critical-tinted block inside a failed widget: title, message and a Retry that revalidates that widget only. */
export function WidgetError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  const t = useTranslations('dashboard');
  return (
    <div role="alert" data-testid="widget-error" className="flex flex-col items-start gap-200 rounded-200 border border-border-critical bg-bg-critical-subdued p-400 text-text">
      <p className="text-body-2 font-bold">{title}</p>
      <p className="text-body-2 font-medium">{message}</p>
      <button type="button" onClick={onRetry} className="h-1000 rounded-300 border border-border bg-bg-surface px-400 text-button-2 font-bold text-text hover:bg-bg-surface-hover">
        {t('retry')}
      </button>
    </div>
  );
}
