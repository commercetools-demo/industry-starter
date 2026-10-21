'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { transformListingImageUrl } from '@/lib/ct/image-config';
import { cn } from '@/lib/cn';
import { buildListingHref } from '@/lib/nav/listing-href';
import {
  BREW_CATEGORY_KEY, BREW_METHODS, MEGA_CONFIG, PRIMARY_NAV, findCategoryByKey, resolveNavHref,
  type MenuId, type NavLink,
} from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';

interface MegaPanelProps {
  menu: MenuId;
  categories: Category[];
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  /** A link was chosen: the menu closes in the same handler that navigates. */
  onNavigate: () => void;
}

const FEATURE_CLASS = 'block py-1.5 font-display text-[16px] font-semibold text-ink hover:text-accent';
const LIST_CLASS = 'block py-1 text-[14px] text-ink-2 hover:text-accent';

/** One hover panel under the header. Closed panels are `inert` and `aria-hidden`, so their links are not focusable. */
export default function MegaPanel({ menu, categories, open, onEnter, onLeave, onNavigate }: MegaPanelProps) {
  const t = useTranslations('shell');
  const entry = MEGA_CONFIG[menu];
  const category = findCategoryByKey(categories, entry.categoryKey);
  const categoryName = t(`nav.${menu}`);

  const links = (items: NavLink[], className: string) =>
    items.flatMap((link) => {
      const href = resolveNavHref(categories, link, entry.categoryKey);
      if (!href) return []; // a category missing from the tree renders no link, never a dead one
      return [
        <li key={link.labelKey}>
          <Link href={href} onClick={onNavigate} className={className}>
            {t(`mega.${link.labelKey}`)}
          </Link>
        </li>,
      ];
    });

  const moreLinks = entry.more.flatMap((id) => {
    const item = PRIMARY_NAV.find((n) => n.id === id);
    const target = item ? findCategoryByKey(categories, item.categoryKey) : null;
    if (!item || !target) return [];
    return [
      <li key={id}>
        <Link href={buildListingHref(target.slug)} onClick={onNavigate} className={LIST_CLASS}>
          {t(`nav.${item.labelKey}`)}
        </Link>
      </li>,
    ];
  });

  const brewCategory = findCategoryByKey(categories, BREW_CATEGORY_KEY);
  const shopAllHref = category ? buildListingHref(category.slug) : null;

  return (
    <div
      id={`mega-${menu}`}
      data-testid={`mega-${menu}`}
      aria-hidden={!open}
      inert={!open}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={cn(
        'absolute inset-x-0 top-full border-b border-line bg-canvas transition-[opacity,translate,visibility] duration-200 motion-reduce:transition-none',
        open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2.5 opacity-0 motion-reduce:translate-y-0',
      )}
    >
      <div className="wrap grid grid-cols-[1.05fr_1.55fr_0.85fr_1.05fr] gap-9 pb-9 pt-10 max-grid3:grid-cols-[1fr_1.4fr_0.9fr]">
        <ul className="m-0 list-none p-0">{links(entry.feature, FEATURE_CLASS)}</ul>

        <div>
          <p className="eyebrow m-0 mb-3">{t('mega.heading', { category: categoryName })}</p>
          <ul className="m-0 list-none columns-2 gap-6 p-0">{links(entry.shop, LIST_CLASS)}</ul>
          {menu === 'pods' ? <p className="mt-4 text-[13px] text-ink-3">{t('mega.pods.compat')}</p> : null}
        </div>

        <div>
          <p className="eyebrow m-0 mb-3">{t('mega.moreHeading')}</p>
          <ul className="m-0 list-none p-0">{moreLinks}</ul>
        </div>

        <div className="max-grid3:hidden">
          {shopAllHref ? (
            <Link href={shopAllHref} onClick={onNavigate} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-card bg-canvas-2">
                {category?.imageUrl ? (
                  <Image
                    src={transformListingImageUrl(category.imageUrl)}
                    alt=""
                    fill
                    sizes="320px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center font-display text-[18px] font-semibold text-ink-2">
                    {category?.name}
                  </span>
                )}
              </div>
              <p className="m-0 mt-3 font-display text-[17px] font-semibold">{t(`mega.${menu}.promo.title`)}</p>
              <p className="m-0 mt-1 text-[13.5px] text-ink-2">{t(`mega.${menu}.promo.line`)}</p>
              <span className="mt-2 inline-block text-[13.5px] font-semibold underline underline-offset-4 group-hover:text-accent">
                {t(`mega.${menu}.promo.cta`)} →
              </span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="bg-canvas-2">
        <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-2 py-3.5 text-[13.5px]">
          {brewCategory ? (
            <>
              <span className="eyebrow">{t('mega.brewLabel')}</span>
              {BREW_METHODS.map((brew) => (
                <Link
                  key={brew.key}
                  href={buildListingHref(brewCategory.slug, { brew: brew.key })}
                  onClick={onNavigate}
                  className="text-ink-2 hover:text-accent"
                >
                  {t(`mega.brew.${brew.labelKey}`)}
                </Link>
              ))}
            </>
          ) : null}
          {shopAllHref ? (
            <Link href={shopAllHref} onClick={onNavigate} className="ml-auto font-semibold text-ink hover:text-accent">
              {t('mega.shopAll', { category: categoryName })} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
