'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Shell of the route error boundary; workstream I replaces the copy and adds the specific cases.
// The error itself is never rendered or logged here: its message can echo configuration or input.
export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-content px-5 py-14 nav:px-8">
      <Card className="mx-auto grid max-w-110 gap-4" role="alert">
        <p className="text-lg text-navy-900">{t('errors.generic')}</p>
        <Button onClick={reset}>{t('common.retry')}</Button>
      </Card>
    </div>
  );
}
