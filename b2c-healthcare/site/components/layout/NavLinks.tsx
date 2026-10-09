import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cx } from '@/components/ui/cx';
import { NAV_LINKS, type NavSection } from '@/lib/nav';

export type HeaderVariant = 'app' | 'home';

export interface NavItem {
  key: string;
  href: string;
  label: string;
  active: boolean;
}

/** The link set of a header variant with the active one marked. Pure; labels come from `shell.nav`. */
export function useNavItems(variant: HeaderVariant, section: NavSection | null, hasArticles: boolean): NavItem[] {
  const t = useTranslations('shell.nav');
  const primary = NAV_LINKS.map((link) => ({
    key: link.section,
    href: link.href,
    label: t(link.labelKey),
    active: link.section === section,
  }));
  if (variant === 'app') return primary;
  return [
    { key: 'home', href: '/', label: t('home'), active: true },
    ...primary,
    ...(hasArticles ? [{ key: 'journal', href: '/journal', label: t('journal'), active: false }] : []),
  ];
}

const DESKTOP_LINK =
  'whitespace-nowrap border-b-2 border-transparent py-1.5 font-display text-sm font-medium text-navy-900 hover:text-brand-700 aria-[current=page]:border-brand-500 aria-[current=page]:text-brand-700';

/** The inline link row; hidden below the nav breakpoint (the menu takes over). */
export function DesktopLinks({ items, className }: { items: NavItem[]; className?: string }) {
  const t = useTranslations('shell');
  return (
    <nav aria-label={t('mainNav')} className={cx('ml-auto flex gap-6 max-nav:hidden', className)}>
      {items.map((item) => (
        <Link key={item.key} href={item.href} aria-current={item.active ? 'page' : undefined} className={DESKTOP_LINK}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
