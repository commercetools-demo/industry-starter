'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { inSection, ROUTES } from '@/lib/site';

export const SECTIONS = [
  { key: 'plumbing', href: ROUTES.plumbing },
  { key: 'waste', href: ROUTES.waste },
  { key: 'about', href: ROUTES.about },
] as const;

/** Desktop links (hidden under 900 px by the design CSS). The current section carries aria-current and the underline. */
export function NavLinks() {
  const t = useTranslations('chrome');
  const pathname = usePathname();
  return (
    <div className="links">
      {SECTIONS.map(({ key, href }) => {
        const current = inSection(pathname, href);
        return <Link key={key} href={href} className={current ? 'on' : undefined} aria-current={current ? 'page' : undefined}>{t(key)}</Link>;
      })}
    </div>
  );
}
