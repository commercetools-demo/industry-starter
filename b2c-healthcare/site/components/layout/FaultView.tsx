'use client';
import { useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface FaultViewProps {
  /** Re-renders the failed segment (Next's `reset`). */
  reset: () => void;
  /** Correlation id Next attaches to a server-side error; the only detail of the error that is shown. */
  digest?: string;
}

/**
 * "Upstream fault" card (error-pages): says the fault is on our side, offers a retry and the home
 * page. It never renders the error's message or stack (they can echo configuration or input);
 * only the correlation id is shown so support can find the server log line.
 */
export function FaultView({ reset, digest }: FaultViewProps) {
  const t = useTranslations('errors.fault');
  return (
    <div className="mx-auto max-w-content px-5 py-14 nav:px-8">
      <Card className="mx-auto grid max-w-110 gap-4" role="alert" data-error-kind="fault">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-heading">{t('title')}</h1>
          <p className="mt-1.5 text-sm text-neutral-600">{t('body')}</p>
        </div>
        <div className="grid gap-2.5">
          <Button onClick={reset} full>
            {t('retry')}
          </Button>
          <ButtonLink href="/" variant="outline" full>
            {t('home')}
          </ButtonLink>
        </div>
        {digest ? <p className="text-xs text-neutral-600">{t('reference', { id: digest })}</p> : null}
      </Card>
    </div>
  );
}
