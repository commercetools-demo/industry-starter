/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscountEditor } from '@/components/discounts/DiscountEditor';
import { titleMetadata } from '@/lib/portal/page-title';

// Editor of one discount (workstream T): /catalog/discounts/product/<id> or /catalog/discounts/cart/<id>.
export default async function DiscountEditorPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== 'product' && kind !== 'cart') notFound();
  return <DiscountEditor kind={kind} id={id} />;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; kind: string }> }): Promise<Metadata> {
  const { locale, kind } = await params;
  return titleMetadata(locale, ['catalog.tabs', kind === 'cart' ? 'cartDiscounts' : 'productDiscounts'], ['nav.items', 'catalog']);
}
