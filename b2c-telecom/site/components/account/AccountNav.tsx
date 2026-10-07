'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link, usePathname } from '@/i18n/routing';
import { cx } from '@/lib/cx';

type NavKey = 'overview' | 'orders' | 'addresses' | 'payments' | 'lists';
const ITEMS: { key: NavKey; href: string; exact: boolean }[] = [
  { key: 'overview', href: '/account', exact: true },
  { key: 'orders', href: '/account/orders', exact: false },
  { key: 'addresses', href: '/account/addresses', exact: false },
  { key: 'payments', href: '/account/payment-methods', exact: false },
  { key: 'lists', href: '/account/lists', exact: false },
];

/** Vertical rail from 1024 px, horizontally scrollable tabs below. The current page carries `aria-current="page"`. */
export function AccountNav(): ReactElement {
  const t = useTranslations('account');
  const pathname = usePathname();
  const isCurrent = (item: (typeof ITEMS)[number]): boolean => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav aria-label={t('nav.label')} data-print="hide" className="overflow-x-auto lg:overflow-visible">
      <ul className="m-0 flex list-none items-center gap-3 p-0 lg:flex-col lg:items-stretch">
        {ITEMS.map((item) => {
          const current = isCurrent(item);
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 w-full items-center whitespace-nowrap rounded-pill px-5 font-display text-sm font-semibold no-underline',
                  current ? 'bg-brand-950 text-text-on-pink' : 'bg-brand-100 text-brand-950 hover:bg-brand-200',
                  FOCUS_RING,
                )}
              >
                {t(`nav.${item.key}`)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-3">
          <LogoutButton />
        </li>
      </ul>
    </nav>
  );
}
