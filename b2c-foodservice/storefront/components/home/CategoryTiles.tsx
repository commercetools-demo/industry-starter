import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { HOME_CONTENT } from '@/content/home';
import { Link } from '@/i18n/routing';
import { flattenTree } from '@/lib/category-tree';
import { transformListingImageUrl } from '@/lib/ct/image-config';
import { categoryHref } from '@/lib/home-links';
import type { Category } from '@/lib/types';

export const MAX_TILES = 4;

/** The configured categories in the configured order, capped at four; a key the tree does not know is skipped. */
export function tileCategories(tree: Category[], keys: string[] = HOME_CONTENT.tiles.categoryKeys): Category[] {
  const byKey = new Map(flattenTree(tree).filter((c) => c.key).map((c) => [c.key as string, c]));
  const found: Category[] = [];
  for (const key of keys) {
    const category = byKey.get(key);
    if (category) found.push(category);
    if (found.length === MAX_TILES) break;
  }
  return found;
}

/**
 * Category tiles (server). Each tile is a real link; the label inside it is the accessible name, so the image is
 * decorative. Without an image: a canvas block with the category's icon. Omitted when no tile resolves.
 */
export default function CategoryTiles({ tree, keys }: { tree: Category[]; keys?: string[] }) {
  const t = useTranslations('home.tiles');
  const tiles = tileCategories(tree, keys);
  if (tiles.length === 0) return null;
  return (
    <section aria-label={t('aria')} className="home-section-tight">
      <ul className="wrap m-0 grid list-none grid-cols-4 gap-5 p-0 max-[1080px]:grid-cols-2 max-mobile:gap-3.5">
        {tiles.map((category) => (
          <li key={category.id} className="min-w-0">
            <Link
              href={categoryHref(category.slug)}
              data-testid="category-tile"
              className="group relative block aspect-[4/5] overflow-hidden rounded-card bg-ink-2 text-surface no-underline"
            >
              {category.imageUrl ? (
                <Image
                  src={transformListingImageUrl(category.imageUrl)}
                  alt=""
                  fill
                  sizes="(min-width: 1081px) 25vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                />
              ) : (
                <span data-testid="tile-placeholder" className="absolute inset-0 flex items-center justify-center text-surface/60">
                  <Icon name="bean" size={48} />
                </span>
              )}
              <span aria-hidden="true" className="home-tile-shade absolute inset-0" />
              <span className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3 font-display text-[17px] font-semibold">
                {category.name}
                <Icon name="arrowR" size={18} className="shrink-0" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
