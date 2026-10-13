// Navigation definition (workstream R-02). Dashboard on top, then four groups in the spec order.
// The "Shop from Malva" group, the Approvals badge and "Roles & permissions" do not exist (owner Q-V01, D-028).
// `scripts/check-routes.mjs` parses the item() calls (id, then the route) and ROUTE_ALLOW_LIST of this file, so keep
// the route as a plain string literal and ROUTE_ALLOW_LIST as a literal array ending in a semicolon.
import { rolesFor, type LogicalRole, type PortalAction } from '@/lib/authz/permissions';

export type IconName =
  | 'home' | 'tag' | 'gift' | 'box' | 'store' | 'doc' | 'mega' | 'mail' | 'users' | 'repeat' | 'return' | 'star' | 'check' | 'user';

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: IconName;
  roles: LogicalRole[];
  /** The view action that decides visibility; `roles` is derived from the permission table. */
  action: PortalAction;
}

export type NavGroupId = 'my-store' | 'my-customers' | 'with-malva' | 'company';
export interface NavGroup {
  id: NavGroupId;
  labelKey: string;
  items: NavItem[];
}

function item(id: string, href: string, icon: IconName, action: PortalAction): NavItem {
  return { id, labelKey: `nav.items.${id}`, href, icon, roles: rolesFor(action), action };
}

export const NAV: { top: NavItem; groups: NavGroup[] } = {
  top: item('dashboard', '/', 'home', 'dashboard.view'),
  groups: [
    {
      id: 'my-store',
      labelKey: 'nav.groups.my-store',
      items: [
        item('catalog', '/catalog', 'tag', 'catalog.view'),
        item('bundles', '/bundles', 'gift', 'bundles.manage'),
        item('import', '/import', 'box', 'import.run'),
        item('store', '/store', 'store', 'store.view'),
        item('content', '/content', 'doc', 'content.view'),
        item('marketing', '/marketing', 'mega', 'marketing.manage'),
        item('email', '/email', 'mail', 'email.manage'),
      ],
    },
    {
      id: 'my-customers',
      labelKey: 'nav.groups.my-customers',
      items: [
        item('customers', '/customers', 'users', 'customers.view'),
        item('subscriptions', '/subscriptions', 'repeat', 'subscriptions.view'),
        item('returns', '/returns', 'return', 'returns.view'),
        item('reviews', '/reviews', 'star', 'reviews.view'),
      ],
    },
    {
      id: 'with-malva',
      labelKey: 'nav.groups.with-malva',
      items: [item('partnership', '/partnership', 'check', 'partnership.view')],
    },
    {
      id: 'company',
      labelKey: 'nav.groups.company',
      items: [
        item('company', '/company', 'users', 'company.view'),
        item('account', '/account', 'user', 'account.view'),
      ],
    },
  ],
};

const hasRole = (it: NavItem, roles: LogicalRole[]) => it.roles.some((r) => roles.includes(r));

/** The navigation a role set may see; groups without an item are dropped. */
export function visibleNav(roles: LogicalRole[]): { top: NavItem; groups: NavGroup[] } {
  return {
    top: NAV.top,
    groups: NAV.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => hasRole(i, roles)) }))
      .filter((g) => g.items.length > 0),
  };
}

/** Flat list of the pages a role set may open (palette and tests). */
export function visibleItems(roles: LogicalRole[]): NavItem[] {
  const v = visibleNav(roles);
  const top = hasRole(v.top, roles) ? [v.top] : [];
  return [...top, ...v.groups.flatMap((g) => g.items)];
}

/** Routes that exist but are not navigation items (locale prefix removed). */
export const ROUTE_ALLOW_LIST: string[] = ['/sign-in', '/register', '/reset', '/reset/[token]', '/pending-approval', '/accept-invite/[token]', '/store/settings', '/store/channels', '/store/share', '/store/theme', '/store/theme/[...slug]', '/content/[...slug]', '/catalog/prices', '/catalog/product-info', '/catalog/product-discounts', '/catalog/cart-discounts', '/catalog/priority', '/catalog/discounts/[kind]/[id]','/company/[tab]', '/account/[tab]', '/customers/[id]'];
