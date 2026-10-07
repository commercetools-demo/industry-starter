import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';

/** A normal render, not an error boundary: the panel's data call failed or timed out and the rest of the page is unaffected. */
export function PanelUnavailable(): ReactElement {
  const t = useTranslations('account');
  return (
    <p role="status" className="m-0 rounded-xl border border-border bg-neutral-50 p-5 text-md text-text-muted">
      {t('unavailable')}
    </p>
  );
}
