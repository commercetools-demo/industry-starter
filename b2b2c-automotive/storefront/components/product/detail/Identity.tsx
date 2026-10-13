// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';

export interface IdentityProps {
  name: string;
  brand: string;
  qualityLabel?: string;
  partNumber: string;
  rating: { average: number; count: number } | null;
}

/** "VEKTRA · OEM", the H1 name, "Part no. …" and the rating (hidden without reviews, with a link to the reviews section). */
export function Identity({ name, brand, qualityLabel, partNumber, rating }: IdentityProps) {
  const t = useTranslations('pdp');
  const eyebrow = [brand, qualityLabel].filter(Boolean).join(' · ');
  return (
    <div className="grid gap-2">
      {eyebrow ? <div className="font-ui text-xs font-bold uppercase tracking-label text-text-subtle">{eyebrow}</div> : null}
      <h1 className="m-0 font-display text-3xl font-semibold leading-tight text-text">{name}</h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-sm text-text-muted">
        <span>{t('partNo', { partNumber })}</span>
        {rating ? (
          <a href="#reviews" aria-label={t('rating', { average: rating.average.toFixed(1), count: rating.count })} className="inline-flex min-h-6 items-center text-rating hover:underline">
            <span aria-hidden="true">
              ★ {rating.average.toFixed(1)} <span className="text-text-subtle">({rating.count})</span>
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
