'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** "Print receipt": the browser's print dialog; `receipt.css` decides what the paper shows. */
export function PrintReceiptButton(): ReactElement {
  const t = useTranslations('account');
  return (
    <Button variant="secondary" data-print="hide" onClick={() => window.print()}>
      {t('order.print')}
    </Button>
  );
}
