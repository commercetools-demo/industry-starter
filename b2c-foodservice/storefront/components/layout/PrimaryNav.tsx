'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/cn';
import { PRIMARY_NAV, findCategoryByKey } from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';

/** The five primary links. A missing category (or an empty tree) falls back to `/` so the bar is never empty. */
export default function PrimaryNav({ categories }: { categories: Category[] }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')} className="flex items-center gap-1 max-mobile:hidden">
      {PRIMARY_NAV.map((item) => {
        const category = findCategoryByKey(categories, item.categoryKey);
        const href = category ? `/category/${category.slug}` : '/';
        const active = category !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={item.id}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative px-3.5 py-2.5 font-display text-[15px] font-semibold',
              active ? 'text-accent' : 'text-ink hover:text-accent focus-visible:text-accent',
            )}
          >
            {t(item.labelKey)}
            <span
              aria-hidden="true"
              className={cn(
                'absolute bottom-1 left-3.5 right-3.5 h-0.5 origin-left bg-current transition-transform duration-200 motion-reduce:transition-none',
                active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
