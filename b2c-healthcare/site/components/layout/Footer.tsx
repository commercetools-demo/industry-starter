'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { FOOTER_COLUMNS, isHomePath, type FooterColumn } from '@/lib/nav';
import type { HeaderVariant } from './NavLinks';
import { Logo } from './Header';

export interface FooterProps {
  /** Explicit variant; by default the home page (`/`) gets the home footer. */
  variant?: HeaderVariant;
  /** Link columns of the home footer (default: the manifest in lib/nav.ts, live pages only). */
  columns?: readonly FooterColumn[];
}

/** Navy footer with the emergency disclaimer on every page; the home page adds the brand blurb and link columns. */
export function Footer({ variant, columns = FOOTER_COLUMNS }: FooterProps) {
  const t = useTranslations('shell.footer');
  const pathname = usePathname();
  const home = (variant ?? (isHomePath(pathname) ? 'home' : 'app')) === 'home';

  const legal = (
    <>
      <span>{t('copyright')}</span>
      <span>{t('emergency')}</span>
    </>
  );

  if (!home) {
    return (
      <footer className="bg-navy-700 py-8 font-body text-sm text-navy-100">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-5 nav:px-8">{legal}</div>
      </footer>
    );
  }

  // A link whose page does not exist yet is omitted; a column without links is omitted too.
  const visible = columns
    .map((column) => ({ ...column, links: column.links.filter((link) => link.live) }))
    .filter((column) => column.links.length > 0);

  return (
    <footer className="bg-navy-700 pt-16 pb-8 font-body text-navy-100">
      <div className="mx-auto grid max-w-content gap-10 px-5 sm:grid-cols-2 nav:px-8 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div>
          <Logo inverse />
          <p className="mt-3 max-w-70 text-sm">{t('blurb')}</p>
        </div>
        {visible.map((column) => (
          <div key={column.headingKey}>
            <h2 className="mb-3.5 font-display text-[length:var(--text-md)] font-medium text-text-on-brand">{t(column.headingKey)}</h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {column.links.map((link) => (
                <li key={`${column.headingKey}-${link.labelKey}`}>
                  <Link href={link.href} className="text-sm text-navy-100 hover:text-text-on-brand">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 border-t border-navy-500 pt-6 text-xs sm:col-span-full">{legal}</p>
      </div>
    </footer>
  );
}
