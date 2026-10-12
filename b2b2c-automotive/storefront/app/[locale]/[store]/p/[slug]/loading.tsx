// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';

const BLOCK = 'animate-pulse rounded-xs bg-surface-subtle motion-reduce:animate-none';

/** Skeleton with the two-column geometry of the product page, so nothing jumps when the data arrives. */
export default function Loading() {
  const t = useTranslations('pdp');
  return (
    <div role="status" aria-busy="true" aria-label={t('loading')} className="mx-auto grid max-w-content gap-6 p-4 min-[64rem]:p-5">
      <div className={`${BLOCK} h-5 w-1/3`} />
      <div className="grid items-start gap-6 min-[42.5rem]:grid-cols-2 min-[64rem]:gap-7">
        <div className={`${BLOCK} aspect-[4/3] w-full`} />
        <div className="grid content-start gap-4">
          <div className={`${BLOCK} h-4 w-1/4`} />
          <div className={`${BLOCK} h-8 w-full`} />
          <div className={`${BLOCK} h-5 w-1/2`} />
          <div className={`${BLOCK} h-7 w-full`} />
          <div className={`${BLOCK} h-8 w-1/3`} />
          <div className={`${BLOCK} h-24 w-full`} />
          <div className={`${BLOCK} h-7 w-1/3`} />
          <div className={`${BLOCK} h-8 w-full`} />
        </div>
      </div>
    </div>
  );
}
