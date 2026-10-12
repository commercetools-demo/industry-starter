import { describe, expect, it } from 'vitest';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { can } from '@/lib/authz/permissions';
import { NAV, ROUTE_ALLOW_LIST, visibleNav, type NavItem } from './nav';

const hrefs = (roles: Parameters<typeof visibleNav>[0]) => {
  const v = visibleNav(roles);
  return [v.top.href, ...v.groups.flatMap((g) => g.items.map((i) => i.href))];
};

const ALL_HREFS = [
  '/', '/catalog', '/bundles', '/import', '/store', '/content', '/marketing', '/email', '/customers', '/subscriptions',
  '/returns', '/reviews', '/partnership', '/company', '/account',
];

const lookup = (catalog: unknown, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], catalog);

describe('navigation (role matrix, plans R section 5)', () => {
  it('nav matrix: admin sees every item', () => {
    expect(hrefs(['admin']).sort()).toEqual([...ALL_HREFS].sort());
  });

  it('nav matrix: buyer hides Brand partnership, Bundles, Email, Content, Marketing, Store & channels, Product import, Customers, Subscriptions', () => {
    const buyer = hrefs(['buyer']);
    for (const hidden of ['/partnership', '/bundles', '/email', '/content', '/marketing', '/store', '/import', '/customers', '/subscriptions']) {
      expect(buyer, hidden).not.toContain(hidden);
    }
    expect(buyer.sort()).toEqual(['/', '/account', '/catalog', '/company', '/returns', '/reviews']);
  });

  it('no Shop from Malva group, no Roles & permissions, no Approvals badge exist for any role', () => {
    expect(NAV.groups.map((g) => g.id)).toEqual(['my-store', 'my-customers', 'with-malva', 'company']);
    const items: NavItem[] = [NAV.top, ...NAV.groups.flatMap((g) => g.items)];
    for (const item of items) {
      expect(item).not.toHaveProperty('badge');
      expect(item.href).not.toMatch(/roles|approvals|quick-order|price-lists|quotes|invoices/);
    }
  });

  it('nav groups keep spec order and drop empty groups', () => {
    expect(visibleNav(['admin']).groups.map((g) => g.id)).toEqual(['my-store', 'my-customers', 'with-malva', 'company']);
    // Buyer has no item in With Malva, so the group is dropped.
    expect(visibleNav(['buyer']).groups.map((g) => g.id)).toEqual(['my-store', 'my-customers', 'company']);
    expect(visibleNav([]).groups).toEqual([]);
  });

  it('every nav item roles agree with the permission table', () => {
    for (const item of [NAV.top, ...NAV.groups.flatMap((g) => g.items)]) {
      for (const role of ['admin', 'buyer'] as const) {
        expect(item.roles.includes(role), `${item.id} ${role}`).toBe(can({ roles: [role], ctPermissions: [] }, item.action));
      }
    }
  });

  it('every nav item has messages in both locales', () => {
    const keys = [NAV.top.labelKey, ...NAV.groups.flatMap((g) => [g.labelKey, ...g.items.map((i) => i.labelKey)])];
    for (const key of keys) {
      for (const catalog of [de, en]) expect(typeof lookup(catalog, key), key).toBe('string');
    }
  });

  it('the route allow-list never repeats a nav route', () => {
    for (const route of ROUTE_ALLOW_LIST) expect(ALL_HREFS).not.toContain(route);
    expect(ROUTE_ALLOW_LIST).toContain('/sign-in');
    expect(ROUTE_ALLOW_LIST).toContain('/pending-approval');
  });
});
