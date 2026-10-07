import { describe, expect, it } from 'vitest';
import type { CategoryDraft } from '../types';
import { buildCategories, categories } from './categories';
import { deviceRecurrencePolicies } from './recurrence-devices';

describe('categories', () => {
  it('eight unique keys, parents exist and are listed first', () => {
    const keys = categories.map((c) => c.key);
    expect(new Set(keys).size).toBe(8);
    for (const c of categories) {
      if (!c.parent) continue;
      expect(keys.indexOf(c.parent)).toBeGreaterThanOrEqual(0);
      expect(keys.indexOf(c.parent)).toBeLessThan(keys.indexOf(c.key));
    }
  });

  it('slugs are unique per locale and both locales are on name and slug', () => {
    for (const locale of ['en-US', 'de-DE']) {
      const slugs = categories.map((c) => c.slug[locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
    for (const c of categories) {
      expect(c.name['en-US'] && c.name['de-DE'] && c.slug['en-US'] && c.slug['de-DE']).toBeTruthy();
    }
  });

  it('the devices category is present with the slug phones-and-devices', () => {
    const devices = categories.find((c) => c.key === 'malva-cat-devices') as CategoryDraft;
    expect(devices.slug['en-US']).toBe('phones-and-devices');
    expect(devices.slug['de-DE']).toBe('handys-und-geraete');
  });

  it('the header reads Phone plans, Wireless internet, Cable internet, Add-ons and devices last', () => {
    const roots = categories.filter((c) => !c.parent).sort((a, b) => Number(a.orderHint) - Number(b.orderHint));
    expect(roots.map((c) => c.name['en-US'])).toEqual(['Phone plans', 'Wireless internet', 'Cable internet', 'Add-ons', 'Phones & devices']);
    expect(roots.map((c) => c.orderHint)).toEqual(['0.1', '0.2', '0.3', '0.4', '0.5']);
  });

  it('subcategories sit under add-ons with the three slugs', () => {
    const children = categories.filter((c) => c.parent === 'malva-cat-add-ons');
    expect(children.map((c) => c.slug['en-US'])).toEqual(['streaming-entertainment', 'security-and-protection', 'routers-and-equipment']);
  });

  it('category assets come from the lock file and none when the key has no entry', () => {
    const lock = { 'malva-cat-cable-internet': { term: 't', images: [{ url: 'https://media.istockphoto.com/a.jpg', dimensions: { w: 612, h: 408 }, photographer: null }] } };
    const built = buildCategories(lock);
    expect(built.find((c) => c.key === 'malva-cat-cable-internet')?.assets).toEqual([
      { key: 'malva-cat-cable-internet-image-1', name: { 'en-US': 'Cable internet', 'de-DE': 'Kabel-Internet' }, sources: [{ uri: 'https://media.istockphoto.com/a.jpg', dimensions: { w: 612, h: 408 } }] },
    ]);
    expect(built.find((c) => c.key === 'malva-cat-devices')?.assets).toBeUndefined();
  });

  it('device policies are monthly schedules with the four keys', () => {
    expect(deviceRecurrencePolicies.map((p) => p.key)).toEqual(['malva-device-installment-12', 'malva-device-installment-24', 'malva-device-installment-36', 'malva-device-lease-24']);
    for (const p of deviceRecurrencePolicies) expect(p.schedule).toEqual({ type: 'standard', value: 1, intervalUnit: 'Months' });
    expect(deviceRecurrencePolicies[0].name).toEqual({ 'en-US': 'Installment, 12 months', 'de-DE': 'Raten, 12 Monate' });
    expect(deviceRecurrencePolicies[3].name).toEqual({ 'en-US': 'Lease, 24 months', 'de-DE': 'Miete, 24 Monate' });
  });
});
