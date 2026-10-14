// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAccount } from '@/hooks/useAccount';
import { Link, usePathname, useRouter } from '@/i18n/routing';

export const MENU_ITEMS = ['overview', 'orders', 'garage', 'addresses', 'paymentMethods', 'subscriptions', 'returns', 'profile'] as const;
export type MenuItem = (typeof MENU_ITEMS)[number];

const SEGMENT: Record<MenuItem, string> = {
  overview: '',
  orders: '/orders',
  garage: '/garage',
  addresses: '/addresses',
  paymentMethods: '/payment-methods',
  subscriptions: '/subscriptions',
  returns: '/returns',
  profile: '/profile',
};

interface Props {
  store: string;
  /** The Subscriptions item shows when subscriptions are purchasable or the customer has recurring orders (D10). */
  showSubscriptions: boolean;
}

/**
 * The account menu: a vertical list from 700 px up, a labelled select below (the spec's layout). The current page carries `aria-current`.
 * Sign out is a button under the list, not a menu item (the menu lists pages).
 */
export function AccountMenu({ store, showSubscriptions }: Props) {
  const t = useTranslations('account.menu');
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAccount();
  const base = `/${store}/account`;
  const items = MENU_ITEMS.filter((item) => item !== 'subscriptions' || showSubscriptions);
  const current = [...items].reverse().find((item) => (item === 'overview' ? pathname === base : pathname.startsWith(`${base}${SEGMENT[item]}`))) ?? 'overview';

  async function signOut() {
    await logout();
    router.replace(`/${store}`);
    router.refresh();
  }

  return (
    <div className="grid content-start gap-3">
      <nav aria-label={t('label')} className="hidden min-[43.75rem]:block">
        <ul className="m-0 grid list-none gap-1 p-0">
          {items.map((item) => (
            <li key={item}>
              <Link
                href={`${base}${SEGMENT[item]}`}
                aria-current={item === current ? 'page' : undefined}
                className={`flex min-h-7 items-center rounded-sm px-3 font-utility text-sm ${item === current ? 'bg-action-subtle font-semibold text-action' : 'text-text-link hover:bg-surface-subtle'}`}
              >
                {t(item)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-[43.75rem]:hidden">
        <Select label={t('selectLabel')} value={current} onChange={(event) => router.push(`${base}${SEGMENT[event.target.value as MenuItem]}`)}>
          {items.map((item) => (
            <option key={item} value={item}>
              {t(item)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Button variant="link" onClick={signOut} className="px-3">
          {t('signOut')}
        </Button>
      </div>
    </div>
  );
}
