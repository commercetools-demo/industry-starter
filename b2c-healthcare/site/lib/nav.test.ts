import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';
import { activeSection, FOOTER_COLUMNS, isHomePath, NAV_BREAKPOINT_PX, NAV_LINKS, type NavSection } from './nav';

describe('design-storefront-shell › Header navigation › Active section', () => {
  const table: Array<[string, NavSection | null]> = [
    ['/doctors/remote', 'remote'],
    ['/doctors/remote/', 'remote'],
    ['/doctors/remote?specialty=dermatology', 'remote'],
    ['/doctors/office', 'office'],
    ['/doctors/office?city=Austin', 'office'],
    ['/prescriptions', 'prescriptions'],
    ['/prescriptions/RX-48213', 'prescriptions'],
    ['/cart', 'prescriptions'],
    ['/checkout', 'prescriptions'],
    ['/checkout/payment', 'prescriptions'],
    ['/order/ord_123', 'prescriptions'],
    ['/order', 'prescriptions'],
    ['/account/labs', 'labs'],
    ['/account/labs/l1', 'labs'],
    ['/labs', 'labs'],
    // not part of any section
    ['/', null],
    ['/account', null],
    ['/account/orders', null],
    ['/account/appointments', null],
    ['/doctor/d1', null],
    ['/login', null],
    ['/search', null],
    // look-alike prefixes must not match
    ['/cartoon', null],
    ['/prescriptions-info', null],
    ['/orders', null],
    ['/doctors', null],
    ['/doctors/remotely', null],
    ['/account/labsx', null],
  ];

  it.each(table)('%s -> %s', (path, expected) => {
    expect(activeSection(path)).toBe(expected);
  });

  it('every primary link is active on its own href and on no other link href', () => {
    for (const link of NAV_LINKS) {
      expect(activeSection(link.href)).toBe(link.section);
    }
    expect(new Set(NAV_LINKS.map((l) => l.section)).size).toBe(NAV_LINKS.length);
  });
});

describe('navigation model', () => {
  it('home path', () => {
    expect(isHomePath('/')).toBe(true);
    expect(isHomePath('')).toBe(true);
    expect(isHomePath('/doctors/remote')).toBe(false);
  });

  it('the menu breakpoint is 900 px', () => {
    expect(NAV_BREAKPOINT_PX).toBe(900);
  });

  it('footer: only live pages are linked and every live target is a designed or content route', () => {
    const live = FOOTER_COLUMNS.flatMap((c) => c.links.filter((l) => l.live).map((l) => l.href));
    expect(live.length).toBeGreaterThan(0);
    for (const href of live) {
      expect([
        '/doctors/remote',
        '/doctors/office',
        '/prescriptions',
        '/account/labs',
        '/about',
        '/contact',
        '/faq',
        '/policies/shipping-and-returns',
        '/policies/terms',
        '/policies/privacy',
      ]).toContain(href);
    }
    const company = FOOTER_COLUMNS.find((c) => c.headingKey === 'company');
    expect(company?.links.every((l) => l.live)).toBe(true);
  });
});

describe('initialsOf', () => {
  it.each([
    ['Sam', 'Rivera', 'SR'],
    ['sam', 'rivera', 'SR'],
    ['Sam', undefined, 'S'],
    [undefined, 'Rivera', 'R'],
    ['  Sam ', ' Rivera', 'SR'],
    ['Élodie', 'Østby', 'ÉØ'],
    [undefined, undefined, ''],
    ['', '', ''],
  ])('%s %s -> %s', (first, last, expected) => {
    expect(initialsOf(first, last)).toBe(expected);
  });
});
