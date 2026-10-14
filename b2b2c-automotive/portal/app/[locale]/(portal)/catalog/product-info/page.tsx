/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { ProductInfoPanel } from '@/components/tailoring/ProductInfoPanel';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Product info": tailored name, description and images, published at once (workstream T).
export default function ProductInfoPage() {
  return <ProductInfoPanel />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'productInfo'], ['nav.items', 'catalog']);
