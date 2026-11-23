import { useTranslations } from 'next-intl';
import ProductRow from '@/components/instore/ProductRow';
import { ScanHeroButton } from '@/components/instore/ScanButtons';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { categoryIcon } from '@/lib/instore/category-icons';
import type { InstoreRow } from '@/lib/instore/category';
import type { Category } from '@/lib/types';

/**
 * The tile grid: two columns, every row as tall as the tallest tile, so all tiles have the same height. `rootKey` picks the icon
 * for every tile (sub-categories use their root's); without it each tile uses its own key.
 */
export function CategoryTileGrid({ categories, rootKey }: { categories: Pick<Category, 'id' | 'name' | 'slug' | 'key'>[]; rootKey?: string }) {
  return (
    <ul className="m-0 grid list-none auto-rows-fr grid-cols-2 gap-3 p-0">
      {categories.map((c) => (
        <li key={c.id} className="min-w-0">
          <CategoryTile name={c.name} slug={c.slug} rootKey={rootKey ?? c.key} />
        </li>
      ))}
    </ul>
  );
}

/** The size of a tile: a thumb-sized target with a large icon and the name, filling its grid cell. */
export function CategoryTile({ name, slug, rootKey }: { name: string; slug: string; rootKey: string | undefined }) {
  return (
    <Link
      href={`/c/${encodeURIComponent(slug)}`}
      data-testid="instore-tile"
      className="transition-press flex h-full min-h-[132px] flex-col items-center justify-center gap-3 rounded-card border border-line-2 bg-surface px-3 py-4 text-center text-ink no-underline hover:border-ink active:scale-[0.98]"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-canvas-2 text-ink">
        <Icon name={categoryIcon(rootKey)} size={36} />
      </span>
      <span className="font-display text-[17px] font-bold leading-tight">{name}</span>
    </Link>
  );
}

/**
 * The In-store home (workstream R): one question, a big scan button and the coffee drinks themselves, as product rows. The
 * categories the In-store visibility lets through (the barista menu) are not tiles to walk into: their products are listed here.
 * Everything else the website's home carries (hero, bestsellers, editorial, subscribe) is left out on purpose.
 */
export default function InstoreHome({ rows }: { rows: InstoreRow[] }) {
  const t = useTranslations('instore.home');
  return (
    <div className="flex flex-col gap-6 px-4 pb-6 pt-5">
      <h1 className="m-0 font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t('title')}</h1>
      <ScanHeroButton />
      <section aria-labelledby="instore-drinks" className="flex flex-col gap-3">
        <h2 id="instore-drinks" className="m-0 text-[15px] font-semibold text-ink-2">
          {t('drinks')}
        </h2>
        {rows.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li key={row.id}>
                <ProductRow row={row} />
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="m-0 py-6 text-center text-[16px] text-ink-2">
            {t('empty')}
          </p>
        )}
      </section>
    </div>
  );
}
