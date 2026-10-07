import type { Category } from '@/lib/types';
import { activeNavKey, buildNavItems } from './nav';

function category(key: string, slugs: { 'en-US': string; 'de-DE': string }, name: string, children: Category[] = []): Category {
  return { id: key, key, name, slug: slugs['en-US'], slugs, children };
}

const TREE: Category[] = [
  category('malva-cat-phone-plans', { 'en-US': 'phone-plans', 'de-DE': 'handytarife' }, 'Phone plans'),
  category('malva-cat-home-wireless', { 'en-US': 'home-wireless-internet', 'de-DE': 'funk-internet' }, 'Wireless internet'),
  category('malva-cat-cable-internet', { 'en-US': 'cable-internet', 'de-DE': 'kabel-internet' }, 'Cable internet'),
  category('malva-cat-add-ons', { 'en-US': 'add-ons', 'de-DE': 'zusatzangebote' }, 'Add-ons', [
    category('malva-cat-streaming', { 'en-US': 'streaming-entertainment', 'de-DE': 'streaming-unterhaltung' }, 'Streaming'),
  ]),
];

describe('nav', () => {
  it('nav items follow the tree order', () => {
    const items = buildNavItems(TREE, 'en-US');
    expect(items.map((item) => item.key)).toEqual(TREE.map((root) => root.key));
    expect(items.map((item) => item.label)).toEqual(['Phone plans', 'Wireless internet', 'Cable internet', 'Add-ons']);
    expect(items[2].path).toBe('/shop/cable-internet');
  });

  it('the path uses the slug of the locale', () => {
    expect(buildNavItems(TREE, 'de-DE')[2].path).toBe('/shop/kabel-internet');
  });

  it('Active category highlighted: add-ons listing and a child category mark the Add-ons item', () => {
    const items = buildNavItems(TREE, 'en-US');
    expect(activeNavKey('/shop/add-ons', items)).toBe('malva-cat-add-ons');
    expect(activeNavKey('/shop/streaming-entertainment', items)).toBe('malva-cat-add-ons');
    expect(activeNavKey('/shop/cable-internet', items)).toBe('malva-cat-cable-internet');
  });

  it('the de-DE slug of the same category maps to the same root', () => {
    const items = buildNavItems(TREE, 'en-US');
    expect(activeNavKey('/shop/kabel-internet', items)).toBe('malva-cat-cable-internet');
    expect(activeNavKey('/shop/streaming-unterhaltung', buildNavItems(TREE, 'de-DE'))).toBe('malva-cat-add-ons');
  });

  it('other routes map to none', () => {
    const items = buildNavItems(TREE, 'en-US');
    for (const path of ['/bundle', '/', '/search', '/shop', '/shop/unknown', '/shop/cable-internet/extra', '/account/orders']) {
      expect(activeNavKey(path, items)).toBeUndefined();
    }
  });

  it('a trailing slash is ignored', () => {
    expect(activeNavKey('/shop/phone-plans/', buildNavItems(TREE, 'en-US'))).toBe('malva-cat-phone-plans');
  });

  it('an empty tree gives no items and no active key', () => {
    expect(buildNavItems([], 'en-US')).toEqual([]);
    expect(activeNavKey('/shop/phone-plans', [])).toBeUndefined();
  });
});
