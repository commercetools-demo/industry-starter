import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';

/** Shown above a page that is served in English because its German text does not exist yet. */
export function FallbackNotice(): ReactElement {
  const t = useTranslations('content');
  return (
    <p role="note" className="mb-7 rounded-md bg-brand-100 px-5 py-4 font-body text-sm text-text">
      {t('fallbackNotice')}
    </p>
  );
}
