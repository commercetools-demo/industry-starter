'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { inSection, ROUTES } from '@/lib/site';
import { CompanySwitcher } from './CompanySwitcher';
import { SignOutButton } from './SignOutButton';

export const PORTAL_ITEMS = [
  { key: 'overview', href: ROUTES.account, exact: true },
  { key: 'visits', href: `${ROUTES.account}/visits` },
  { key: 'documents', href: `${ROUTES.account}/documents` },
  { key: 'invoices', href: `${ROUTES.account}/invoices` },
  { key: 'quotes', href: `${ROUTES.account}/quotes` },
  { key: 'sites', href: `${ROUTES.account}/sites` },
  { key: 'team', href: `${ROUTES.account}/team` },
  { key: 'settings', href: `${ROUTES.account}/settings` },
] as const;

/** Left sidebar. Collapses into a stacked block under 900 px (the grid in PortalShell is overridden by portal.css). */
export function PortalNav({ firstName }: { firstName: string }) {
  const t = useTranslations('portal');
  const pathname = usePathname();
  return (
    <aside className="portal-side" aria-label={t('navLabel')}>
      <CompanySwitcher />
      <p className="overline" style={{ margin: '16px 0 8px' }}>{t('hello', { name: firstName.toUpperCase() })}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 2 }}>
        {PORTAL_ITEMS.map((item) => {
          const current = 'exact' in item && item.exact ? pathname === item.href : inSection(pathname, item.href);
          return (
            <li key={item.key}>
              <Link href={item.href} aria-current={current ? 'page' : undefined} className={`portal-link${current ? ' on' : ''}`}>{t(`nav.${item.key}`)}</Link>
            </li>
          );
        })}
      </ul>
      <SignOutButton />
    </aside>
  );
}
