import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { CountNoun } from '@/lib/listing/kinds';

export type EmptyLink = { key: string; name: string; href: string };

type ListingEmptyProps =
  | { variant: 'empty'; links: EmptyLink[] }
  | { variant: 'no-match'; noun: CountNoun; clearHref: string; links?: undefined };

/**
 * Never a blank page. `empty`: the category has no offers for this market (an explicit state with links to the other categories).
 * `no-match`: the chosen filter keeps nothing; the active filter stays visible above (AppliedFilters) and "Clear filters" resets it.
 */
export function ListingEmpty(props: ListingEmptyProps): ReactElement {
  const t = useTranslations('plp');
  if (props.variant === 'no-match') {
    return (
      <section aria-labelledby="listing-empty-title" className="flex flex-col items-start gap-5 rounded-xl border border-border bg-surface-brand-subtle p-8">
        <h2 id="listing-empty-title" className="m-0 font-display text-2xl font-bold">
          {t(`nomatch.${props.noun}`)}
        </h2>
        <Button href={props.clearHref} variant="secondary">
          {t('filter.clear')}
        </Button>
      </section>
    );
  }
  return (
    <section aria-labelledby="listing-empty-title" className="flex flex-col items-start gap-5 rounded-xl border border-border bg-surface-brand-subtle p-8">
      <h2 id="listing-empty-title" className="m-0 font-display text-2xl font-bold">
        {t('empty.title')}
      </h2>
      <p className="m-0 max-w-xl text-md">{t('empty.body')}</p>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {props.links.map((link) => (
          <li key={link.key}>
            <Button href={link.href} variant="secondary" size="sm">
              {link.name}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
