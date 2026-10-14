/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { medicinePathForSku } from '@/lib/medicine-key';

/** A medicine name that links to its page (by SKU or product key); plain text when it is not a catalog medicine. */
export function MedicineLink({ sku, productKey, className, children }: { sku?: string | null; productKey?: string; className?: string; children: ReactNode }) {
  const href = productKey ? `/medicine/${productKey}` : medicinePathForSku(sku);
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className={className ?? 'text-text-link hover:underline'}>
      {children}
    </Link>
  );
}
