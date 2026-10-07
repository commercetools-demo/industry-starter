import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import type { SearchParams } from '@/lib/search/params';
import { SearchSortSelect } from './SearchSortSelect';

/** "3 results for “cable”" (a status region, so a change is announced) and the sort control (hidden for a single result). */
export function ResultsHeader({ count, query, params }: { count: number; query: string; params: SearchParams }): ReactElement {
  const t = useTranslations('search');
  return (
    <div className="flex flex-wrap items-center justify-between gap-5">
      <p role="status" className="m-0 font-display text-md font-semibold text-brand-900">
        {t('found', { count, query })}
      </p>
      {count >= 2 ? <SearchSortSelect params={params} /> : null}
    </div>
  );
}
