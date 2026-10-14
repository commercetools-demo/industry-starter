/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { PriorityLists } from '@/components/discounts/PriorityLists';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Discount priority" (workstream T).
export default function PriorityPage() {
  return <PriorityLists />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'priority'], ['nav.items', 'catalog']);
