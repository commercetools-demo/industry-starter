import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { formatMoney } from '@/lib/format';
import type { CategoryTileData } from '@/lib/home/derive';
import type { Locale } from '@/lib/types';

type CategoryTilesProps = { locale: Locale; tiles: CategoryTileData[] };

/** "Shop by category": one card per top-level category, the whole card is the link. */
export function CategoryTiles({ locale, tiles }: CategoryTilesProps): ReactElement | null {
  const t = useTranslations('home.categories');
  const tPlp = useTranslations('plp');
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="home-categories" className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 md:px-10">
      <h2 id="home-categories" className="m-0 font-display text-4xl font-bold">
        {t('title')}
      </h2>
      <ul className="m-0 grid list-none gap-7 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16.25rem),1fr))]">
        {tiles.map((tile) => {
          const action = tile.fromPrice ? t('from', { price: formatMoney(tile.fromPrice, locale) }) : t('browse');
          return (
            <li key={tile.key} className="flex">
              <Link
                href={`/shop/${tile.slug}`}
                className={`flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-text no-underline hover:shadow-md ${FOCUS_RING}`}
              >
                <span className="bg-brand-500 p-7 font-display text-3xl font-bold text-text-on-brand">{tile.name}</span>
                <span className="flex flex-1 flex-col gap-5 p-7">
                  {tile.blurbKey ? <span className="text-md leading-normal text-text-muted">{tPlp(`blurb.${tile.blurbKey}`)}</span> : null}
                  <span className="mt-auto font-display text-sm font-semibold text-action">{action}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
