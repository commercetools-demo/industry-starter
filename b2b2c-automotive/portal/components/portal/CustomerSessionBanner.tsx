'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useViewer } from '@/context/ViewerContext';
import { exitCustomerSession } from '@/hooks/useCopilotApi';

/** Warning bar shown whenever a seller user acts for a customer (`actingAs` in the session); Exit restores the seller's own identity. */
export function CustomerSessionBanner() {
  const t = useTranslations('banner');
  const { actingAs } = useViewer();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!actingAs) return null;

  async function exit() {
    setBusy(true);
    await exitCustomerSession();
    router.refresh();
    setBusy(false);
  }

  return (
    <div role="status" data-testid="customer-session-banner" className="flex flex-wrap items-center justify-between gap-300 bg-bg-warning-subdued px-800 py-250 text-body-2 font-semibold text-text narrow:px-400">
      <span>{t('actingAs', { customer: actingAs })}</span>
      <button
        type="button"
        disabled={busy}
        onClick={exit}
        className="h-1000 whitespace-nowrap rounded-200 border border-border bg-bg-surface px-300 text-button-2 font-bold text-text hover:bg-bg-surface-hover disabled:text-text-disabled"
      >
        {t('exit')}
      </button>
    </div>
  );
}
