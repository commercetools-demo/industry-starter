import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { CloseIcon } from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { toQueryString, withListingChange } from '@/lib/listing/params';
import type { ListingParams } from '@/lib/types';

/** One removable pill per applied filter ("Up to 500 Mbps ✕"); each pill is a link that drops that parameter. Nothing without a filter. */
export function AppliedFilters({ filter, params, basePath }: { filter: string | null; params: ListingParams; basePath: string }): ReactElement | null {
  const t = useTranslations('plp.filter');
  if (!filter) return null;
  const label = t(filter);
  return (
    <ul aria-label={t('applied')} className="m-0 flex list-none flex-wrap gap-3 p-0">
      <li>
        <Link
          href={`${basePath}${toQueryString(withListingChange(params, { filter: null }))}`}
          aria-label={t('remove', { label })}
          className={cx('inline-flex min-h-11 items-center gap-3 rounded-pill bg-brand-950 px-5 py-3 font-display text-sm font-semibold text-text-on-pink no-underline', FOCUS_RING)}
        >
          {label}
          <CloseIcon />
        </Link>
      </li>
    </ul>
  );
}
