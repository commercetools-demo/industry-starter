'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { buildListingHref } from '@/lib/nav/listing-href';
import type { Category } from '@/lib/types';

/**
 * Primary navigation of a brand without mega menus (Malva Drinks): the root categories of its product selection, as plain links.
 * The category tree is already scoped to the brand, so nothing else is listed.
 */
export default function BrandNav({ categories }: { categories: Category[] }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')} className="flex items-center gap-1 max-mobile:hidden">
      {categories.map((category) => {
        const href = buildListingHref(category.slug);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={category.id}
            prefetch={false}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-pill px-3.5 py-2 text-[14px] font-semibold text-ink no-underline hover:bg-canvas-2',
              active && 'bg-canvas-2',
            )}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
