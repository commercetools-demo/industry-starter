/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { DiscountList } from '@/components/discounts/DiscountList';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Product discounts" (workstream T).
export default function ProductDiscountsPage() {
  return <DiscountList kind="product" />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'productDiscounts'], ['nav.items', 'catalog']);
