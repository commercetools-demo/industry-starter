/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { PricesTable } from '@/components/pricing/PricesTable';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Price overrides" (workstream T).
export default function PricesPage() {
  return <PricesTable />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'prices'], ['nav.items', 'catalog']);
