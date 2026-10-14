/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

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
