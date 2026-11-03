'use client';

import { useTranslations } from 'next-intl';
import { Link, useBrand } from '@/i18n/routing';
import { brandTabs } from '@/lib/brands';
import { cn } from '@/lib/cn';

/**
 * The brand switcher: a tab-like strip above the promise bar and header. The current brand is the first tab (selected); the other
 * brands follow. A tab goes to that brand's home page in the current market.
 */
export default function BrandSwitcher() {
  const t = useTranslations('shell.brandSwitcher');
  const current = useBrand();
  return (
    <nav aria-label={t('label')} className="border-b border-line bg-canvas-2">
      <ul className="mx-auto flex max-w-[var(--maxw)] list-none gap-1 px-5 py-0 m-0">
        {brandTabs(current).map((brand, index) => {
          const selected = index === 0;
          return (
            <li key={brand.slug}>
              <Link
                href="/"
                brand={brand.slug}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex items-center border-b-2 px-3 py-2 text-[12.5px] font-semibold tracking-[0.02em] no-underline',
                  selected ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink',
                )}
              >
                {t(`brands.${brand.slug}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
