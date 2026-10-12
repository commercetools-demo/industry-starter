import type { Category } from '@/lib/types';
import { activeNavKey, buildNavItems, splitNavItems } from './nav';

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
    expect(items.map((item) => item.key)).toEqual(['malva-cat-phone-plans', 'malva-cat-home-wireless', 'malva-cat-cable-internet']);
    expect(items.map((item) => item.label)).toEqual(['Phone plans', 'Wireless internet', 'Cable internet']);
    expect(items[2].path).toBe('/shop/cable-internet');
  });

  it('the path uses the slug of the locale', () => {
    expect(buildNavItems(TREE, 'de-DE')[2].path).toBe('/shop/kabel-internet');
  });

  it('Add-ons is not navigation: no item, and its pages mark nothing as active', () => {
    const items = buildNavItems(TREE, 'en-US');
    expect(items.some((item) => item.key === 'malva-cat-add-ons')).toBe(false);
    expect(activeNavKey('/shop/add-ons', items)).toBeUndefined();
    expect(activeNavKey('/shop/streaming-entertainment', items)).toBeUndefined();
    expect(activeNavKey('/shop/cable-internet', items)).toBe('malva-cat-cable-internet');
  });

  it('the de-DE slug of the same category maps to the same root', () => {
    expect(activeNavKey('/shop/kabel-internet', buildNavItems(TREE, 'en-US'))).toBe('malva-cat-cable-internet');
    expect(activeNavKey('/shop/kabel-internet', buildNavItems(TREE, 'de-DE'))).toBe('malva-cat-cable-internet');
  });

  it('splits the plan categories (menu order) from the other roots', () => {
    const devices = category('malva-cat-devices', { 'en-US': 'phones-and-devices', 'de-DE': 'geraete' }, 'Phones and devices');
    const { plans, others } = splitNavItems(buildNavItems([devices, ...TREE], 'en-US'));
    expect(plans.map((plan) => [plan.id, plan.key])).toEqual([
      ['phone', 'malva-cat-phone-plans'],
      ['wireless', 'malva-cat-home-wireless'],
      ['cable', 'malva-cat-cable-internet'],
    ]);
    expect(others.map((item) => item.key)).toEqual(['malva-cat-devices']);
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
