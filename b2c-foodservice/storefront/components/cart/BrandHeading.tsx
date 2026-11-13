'use client';

import { useTranslations } from 'next-intl';
import type { BrandSection } from '@/lib/cart/brand-sections';
import { useMoney } from './use-cart-ui';

/** Heading of one brand section of a mixed bag: the brand name and the brand's own subtotal (one bag, one checkout). */
export default function BrandHeading({ section, level = 2 }: { section: BrandSection; level?: 2 | 3 }) {
  const t = useTranslations('cart.brand');
  const money = useMoney();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div data-brand-section={section.brand} className="mb-2 mt-6 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2 first:mt-2">
      <Heading className="m-0 font-display text-[18px] font-semibold text-ink">{section.name}</Heading>
      <p className="m-0 text-[13px] text-ink-2">{t('subtotal', { amount: money(section.subtotal) })}</p>
    </div>
  );
}
