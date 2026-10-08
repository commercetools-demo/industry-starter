import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_NAV, activeAccountItem } from './account-nav';

const PROTECTED_DIR = join(import.meta.dirname, '..', 'app', '[locale]', '(protected)');

describe('design-account-area: account nav registry', () => {
  it('an item appears only when its route exists: every entry has a page', () => {
    for (const item of ACCOUNT_NAV) {
      expect(existsSync(join(PROTECTED_DIR, item.href, 'page.tsx')), item.href).toBe(true);
    }
  });

  it('starts with the four designed items; addresses and profile follow', () => {
    expect(ACCOUNT_NAV.map((i) => i.key)).toEqual(['overview', 'labs', 'appointments', 'orders', 'lists', 'auto-refill', 'addresses', 'profile']);
  });

  it.each([
    ['/account', 'overview'],
    ['/account/', 'overview'],
    ['/account/labs', 'labs'],
    ['/account/labs/LAB-50302?x=1', 'labs'],
    ['/account/appointments', 'appointments'],
    ['/account/addresses', 'addresses'],
    ['/account/lists/mlv-list-1', 'lists'],
    ['/account/auto-refill', 'auto-refill'],
  ])('%s activates %s', (path, key) => {
    expect(activeAccountItem(path)?.key).toBe(key);
  });

  it('an unregistered account path activates nothing', () => {
    expect(activeAccountItem('/account/unknown')).toBeNull();
    expect(activeAccountItem('/doctors')).toBeNull();
  });
});
