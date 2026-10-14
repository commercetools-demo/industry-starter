/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import type { CategoryTile } from '@/lib/search/tiles';
import { CategoryTiles } from './CategoryTiles';

/** "No results for “…”": says so, never shows an empty grid, and offers the curated categories. The query stays editable in the strip above. */
export function NoResults({ query, tiles }: { query: string; tiles: CategoryTile[] }): ReactElement {
  const t = useTranslations('search');
  return (
    <section aria-labelledby="search-none-title" className="flex flex-col items-start gap-5 rounded-xl border border-border bg-surface-brand-subtle p-8">
      <h2 id="search-none-title" className="m-0 font-display text-2xl font-bold">
        {t('none.title', { query })}
      </h2>
      <p className="m-0 max-w-xl text-md">{t('none.body')}</p>
      <CategoryTiles tiles={tiles} label={t('browse')} />
    </section>
  );
}
