// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { GRID_CLASS } from '@/components/listing/ProductGrid';

const BLOCK = 'animate-pulse rounded-xs bg-surface-subtle motion-reduce:animate-none';

/** `loading.tsx` of the listing routes: same page geometry as the result (header, panel, cards) so nothing jumps when the data arrives. */
export function ListingSkeleton({ cards = 8 }: { cards?: number }) {
  const t = useTranslations('listing');
  return (
    <div role="status" aria-busy="true" aria-label={t('loading')} className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <div className={`${BLOCK} h-5 w-1/3`} />
      <div className={`${BLOCK} h-7 w-full`} />
      <div className="grid gap-2">
        <div className={`${BLOCK} h-7 w-1/2`} />
        <div className={`${BLOCK} h-5 w-1/4`} />
      </div>
      <div className="grid items-start gap-4 min-[64rem]:gap-5 min-[43.75rem]:grid-cols-[14.375rem_minmax(0,1fr)]">
        <div className={`${BLOCK} hidden h-[20rem] min-[43.75rem]:block`} />
        <div className={GRID_CLASS}>
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="grid content-start gap-2 rounded-md border border-border bg-surface p-3 shadow-card">
              <div className={`${BLOCK} aspect-[4/3]`} />
              <div className={`${BLOCK} h-4 w-1/3`} />
              <div className={`${BLOCK} h-5 w-full`} />
              <div className={`${BLOCK} h-5 w-2/3`} />
              <div className={`${BLOCK} h-6 w-1/2`} />
              <div className={`${BLOCK} h-7 w-full`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
