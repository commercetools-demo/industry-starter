import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { CloseIcon } from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { TAG_CHIP, useTagLabel } from './TagLinks';

const MAX_TAGS = 3;

type BlogFiltersProps = {
  /** Every topic of the published articles. */
  allTags: string[];
  /** Topics currently applied (AND), in URL order. */
  applied: string[];
};

function hrefFor(tags: string[]) {
  return tags.length === 0 ? '/blog' : { pathname: '/blog', query: { tag: tags } };
}

/**
 * Topic filter as plain links (works without scripts). Applied topics are dark chips whose link removes only that topic;
 * the other topics add themselves, up to three.
 */
export function BlogFilters({ allTags, applied }: BlogFiltersProps): ReactElement {
  const t = useTranslations('content.blog');
  const label = useTagLabel();
  const tags = [...new Set([...allTags, ...applied])];
  return (
    <nav aria-label={t('filterLabel')}>
      <ul className="m-0 flex list-none flex-wrap items-center gap-3 p-0">
        {tags.map((tag) => {
          const isApplied = applied.includes(tag);
          if (isApplied) {
            return (
              <li key={tag}>
                <Link
                  href={hrefFor(applied.filter((other) => other !== tag))}
                  aria-label={t('removeFilter', { tag: label(tag) })}
                  className={`${TAG_CHIP} bg-brand-950 text-text-on-pink`}
                >
                  {label(tag)}
                  <CloseIcon />
                </Link>
              </li>
            );
          }
          if (applied.length >= MAX_TAGS) {
            return (
              <li key={tag}>
                <span className={`${TAG_CHIP} bg-brand-50 text-text-muted`}>{label(tag)}</span>
              </li>
            );
          }
          return (
            <li key={tag}>
              <Link href={hrefFor([...applied, tag])} className={`${TAG_CHIP} bg-brand-100 text-brand-950 hover:bg-brand-200`}>
                {label(tag)}
              </Link>
            </li>
          );
        })}
        {applied.length > 0 ? (
          <li>
            <Link href="/blog" className="inline-flex min-h-11 items-center px-3 font-display text-sm font-semibold text-text-link underline underline-offset-4">
              {t('clearAll')}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
