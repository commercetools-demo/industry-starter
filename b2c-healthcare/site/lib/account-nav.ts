// Account side navigation registry (design-account-area: Account layout and navigation).
// Pure data: no React, no server imports. A later workstream adds its entry in the same commit as its route
// (S Orders is here already; T: My medicines, Auto-refill, Payment methods; U: Allowance), so an item appears
// only when its page exists. `account-nav.test.ts` fails when an entry points at a route without a page.

export interface AccountNavItem {
  key: string;
  /** Locale-less path. */
  href: string;
  /** Key under `account.nav` in the message catalog. */
  labelKey: string;
  /** Active only on this exact path (the overview); otherwise the item is also active below its path. */
  exact?: boolean;
}

export const ACCOUNT_NAV: readonly AccountNavItem[] = [
  { key: 'overview', href: '/account', labelKey: 'overview', exact: true },
  { key: 'labs', href: '/account/labs', labelKey: 'labs' },
  { key: 'appointments', href: '/account/appointments', labelKey: 'appointments' },
  { key: 'orders', href: '/account/orders', labelKey: 'orders' },
  { key: 'lists', href: '/account/lists', labelKey: 'lists' },
  { key: 'auto-refill', href: '/account/auto-refill', labelKey: 'autoRefill' },
  { key: 'payment-methods', href: '/account/payment-methods', labelKey: 'paymentMethods' },
  { key: 'addresses', href: '/account/addresses', labelKey: 'addresses' },
  { key: 'profile', href: '/account/profile', labelKey: 'profile' },
];

/** The item that is active for a locale-less pathname (query, hash and trailing slash ignored), or null. */
export function activeAccountItem(pathname: string, items: readonly AccountNavItem[] = ACCOUNT_NAV): AccountNavItem | null {
  const path = (pathname.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/';
  return items.find((item) => (item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`))) ?? null;
}
