import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { ADDONS_CATEGORY_KEY } from '@/lib/config/listing';
import { formatMoney } from '@/lib/format';
import type { PopularAddon } from '@/lib/home/derive';
import { categoryPath, offerPath } from '@/lib/listing/links';
import type { Category, Locale } from '@/lib/types';

type PopularAddonsProps = { locale: Locale; tree: Category[]; addons: PopularAddon[] };

/** The "Popular add-ons" band; hidden when no add-on can be shown. Each tile opens the add-on's canonical card (D-052). */
export function PopularAddons({ locale, tree, addons }: PopularAddonsProps): ReactElement | null {
  const t = useTranslations('home.addons');
  const tiles = addons.flatMap((addon) => {
    const href = offerPath(addon.offer, locale, tree);
    return href === undefined ? [] : [{ addon, href }];
  });
  if (tiles.length === 0) return null;
  const viewAll = categoryPath(ADDONS_CATEGORY_KEY, locale, tree);
  return (
    <section aria-labelledby="home-addons" className="bg-surface-brand-subtle py-(--ext-space-56)">
      <div className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-5">
          <h2 id="home-addons" className="m-0 font-display text-4xl font-bold">
            {t('title')}
          </h2>
          {viewAll ? (
            <Link href={viewAll} className={`font-display text-md font-semibold text-action ${FOCUS_RING}`}>
              {t('viewAll')}
            </Link>
          ) : null}
        </div>
        <ul className="m-0 grid list-none gap-5 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12.5rem),1fr))]">
          {tiles.map(({ addon, href }) => (
            <li key={addon.key}>
              <Link href={href} className={`flex items-center gap-5 rounded-lg bg-surface p-5 text-text no-underline hover:shadow-md ${FOCUS_RING}`}>
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-pink-900 font-display text-xl font-bold text-text-on-pink">
                  {addon.initial}
                </span>
                <span className="flex flex-col">
                  <span className="font-display text-md font-semibold">{addon.name}</span>
                  <span className="text-sm text-text-muted">{t('price', { price: formatMoney(addon.price, locale) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
