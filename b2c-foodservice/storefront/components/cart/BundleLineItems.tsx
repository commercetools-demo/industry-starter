'use client';

import { useTranslations } from 'next-intl';
import Badge from '@/components/ui/Badge';
import type { CartLine } from '@/lib/types';

/**
 * The parts of a preset bundle in the bag (workstream V, D8): the bundle row shows its saving and the names of the machine
 * and the pods. The parts are not rows of their own, so the names are the only place they appear.
 */
export default function BundleLineItems({ bundle }: { bundle: NonNullable<CartLine['bundle']> }) {
  const t = useTranslations('cart.line.bundle');
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div>
        <Badge>{t('badge', { percent: bundle.discountPercent })}</Badge>
      </div>
      <p className="m-0 text-[12.5px] font-semibold text-ink-2">{t('includes')}</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px] text-ink-3">
        {bundle.items.map((item) => (
          <li key={item.sku} data-bundle-part={item.role}>
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
