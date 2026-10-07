import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/Skeleton';

/** Placeholder while a dashboard panel loads. */
export function PanelSkeleton({ lines = 3 }: { lines?: number }): ReactElement {
  const t = useTranslations('account');
  return (
    <div role="status" aria-busy="true" aria-label={t('loading')} className="flex flex-col gap-3">
      {Array.from({ length: lines }, (_unused, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}
