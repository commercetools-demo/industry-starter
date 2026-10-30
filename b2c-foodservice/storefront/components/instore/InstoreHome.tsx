import { useTranslations } from 'next-intl';
import { ScanHeroButton } from '@/components/instore/ScanButtons';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import { categoryIcon } from '@/lib/instore/category-icons';
import type { Category } from '@/lib/types';

/** The size of a tile: a thumb-sized target with a large icon and the name, two to a row. */
export function CategoryTile({ name, slug, rootKey }: { name: string; slug: string; rootKey: string | undefined }) {
  return (
    <Link
      href={`/c/${encodeURIComponent(slug)}`}
      data-testid="instore-tile"
      className="transition-press flex min-h-[132px] flex-col items-center justify-center gap-3 rounded-card border border-line-2 bg-surface px-3 py-4 text-center text-ink no-underline hover:border-ink active:scale-[0.98]"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-canvas-2 text-ink">
        <Icon name={categoryIcon(rootKey)} size={36} />
      </span>
      <span className="font-display text-[17px] font-bold leading-tight">{name}</span>
    </Link>
  );
}

/**
 * The In-store home (workstream R): one question, a big scan button and the root categories as large tiles. Everything else the
 * website's home carries (hero, bestsellers, editorial, subscribe) is left out on purpose: less to read, less to download.
 */
export default function InstoreHome({ tree }: { tree: Category[] }) {
  const t = useTranslations('instore.home');
  return (
    <div className="flex flex-col gap-6 px-4 pb-6 pt-5">
      <h1 className="m-0 font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t('title')}</h1>
      <ScanHeroButton />
      <section aria-labelledby="instore-categories" className="flex flex-col gap-3">
        <h2 id="instore-categories" className="m-0 text-[15px] font-semibold text-ink-2">
          {t('categories')}
        </h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
          {tree.map((c) => (
            <li key={c.id} className="min-w-0">
              <CategoryTile name={c.name} slug={c.slug} rootKey={c.key} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
