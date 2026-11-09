// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from examples/retail/storefront-web/components/generative/index.tsx; changes: add handler takes a product id and arrives through the provider's prop, payload types from components/assistant/payloads.ts, translated notice for an unknown component.

'use client';

import { useTranslations } from 'next-intl';
import type { UIBlock, UISlotStatus } from '../protocol';
import type { CheckoutPayload, ComparisonPayload, GuidePayload, OrderStatusPayload, PlanPayload, ProductsPayload } from '../payloads';
import CheckoutSummary from './CheckoutSummary';
import ComparisonGrid from './ComparisonGrid';
import GuideCard from './GuideCard';
import OrderStatusCard from './OrderStatusCard';
import PlanChecklist from './PlanChecklist';
import ProductCarousel from './ProductCarousel';

function UnknownBlock() {
  const t = useTranslations('assistant.cards');
  return <p className="rounded-lg border border-(--line) bg-(--well) px-3 py-2 text-[13px] text-(--ink-soft)">{t('unknown')}</p>;
}

/** One entry per shopping presentation tool. The add handler is the provider's (one call site for analytics and revalidation). */
export default function AssistantBlock({
  block,
  status,
  onAdd,
}: {
  block: UIBlock;
  status: UISlotStatus;
  onAdd?: (productId: string, quantity?: number) => Promise<boolean>;
}) {
  const partial = status !== 'final';
  switch (block.component) {
    case 'products':
      return <ProductCarousel payload={block.payload as ProductsPayload} onAdd={onAdd} partial={partial} />;
    case 'comparison':
      return <ComparisonGrid payload={block.payload as ComparisonPayload} partial={partial} />;
    case 'plan':
      return <PlanChecklist payload={block.payload as PlanPayload} onAdd={onAdd} partial={partial} />;
    case 'guide':
      return <GuideCard payload={block.payload as GuidePayload} />;
    case 'order_status':
      if (partial) return null;
      return <OrderStatusCard payload={block.payload as OrderStatusPayload} />;
    case 'checkout':
      if (partial) return null;
      return <CheckoutSummary payload={block.payload as CheckoutPayload} />;
    default:
      return partial ? null : <UnknownBlock />;
  }
}
