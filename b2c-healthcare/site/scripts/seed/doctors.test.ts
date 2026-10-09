import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data/categories';
import { channelKey, DOCTORS, doctorDraft, doctorKey, doctorSku } from './data/doctors';
import { CHANNELS, CITIES, SPECIALTIES } from './data/types';
import { createFakeRoot } from './fake-root';
import { makeCtx, runSteps } from './lib';
import { doctorSteps, foundationSteps } from './steps';

const price = (cents: number, mode: 'remote' | 'office') => ({ value: { currencyCode: 'USD', centAmount: cents }, channel: { typeId: 'channel', key: `mlv-${mode}` } });

describe('doctor data', () => {
  it('has the 8 prototype doctors with unique keys, SKUs and slugs', () => {
    expect(DOCTORS).toHaveLength(8);
    expect(new Set(DOCTORS.map(doctorKey)).size).toBe(8);
    expect(new Set(DOCTORS.map(doctorSku)).size).toBe(8);
    expect(new Set(DOCTORS.map((d) => d.slug)).size).toBe(8);
    expect(doctorKey(DOCTORS[0])).toBe('mlv-doc-amara-okafor');
    expect(doctorSku(DOCTORS[0])).toBe('DOC-amara-okafor');
  });

  it('fees are the prototype fees in cents', () => {
    const okafor = doctorDraft(DOCTORS[0]);
    expect(okafor.masterVariant.prices).toEqual([price(3500, 'remote'), price(5500, 'office')]);
    const marchetti = DOCTORS.find((d) => d.slug === 'sofia-marchetti');
    expect(marchetti?.fees).toEqual({ remote: 9500, office: 14000 });
  });

  it('every doctor has at least one price in USD on an existing price channel, and modes match the price channels', () => {
    const channels = new Set(CHANNELS.map((c) => c.key));
    for (const d of DOCTORS) {
      const draft = doctorDraft(d);
      const prices = draft.masterVariant.prices;
      expect(prices.length).toBeGreaterThanOrEqual(1);
      for (const p of prices) {
        expect(p.value.currencyCode).toBe('USD');
        expect(Number.isInteger(p.value.centAmount) && p.value.centAmount > 0).toBe(true);
        expect(channels.has(p.channel.key)).toBe(true);
      }
      const modes = draft.masterVariant.attributes.find((a) => a.name === 'modes')?.value as ('remote' | 'office')[];
      expect(modes.map(channelKey).sort()).toEqual(prices.map((p) => p.channel.key).sort());
    }
  });

  it('one doctor offers only remote and one only office, so a disabled mode can be tested (workstream L)', () => {
    const only = (mode: 'remote' | 'office') => DOCTORS.filter((d) => Object.keys(d.fees).join() === mode).map((d) => d.slug);
    expect(only('remote')).toEqual(['tomas-alvarez']);
    expect(only('office')).toEqual(['leila-haddad']);
    const draft = doctorDraft(DOCTORS.find((d) => d.slug === 'leila-haddad') ?? DOCTORS[0]);
    expect(draft.masterVariant.prices).toEqual([price(10000, 'office')]);
    expect(draft.masterVariant.attributes.find((a) => a.name === 'modes')?.value).toEqual(['office']);
  });

  it('a one-mode doctor gets one price and one mode', () => {
    const remoteOnly = { ...DOCTORS[0], fees: { remote: 3500 } };
    const draft = doctorDraft(remoteOnly);
    expect(draft.masterVariant.prices).toEqual([price(3500, 'remote')]);
    expect(draft.masterVariant.attributes.find((a) => a.name === 'modes')?.value).toEqual(['remote']);
  });

  it('specialties and cities exist as enum values and categories; the 7 specialties are all used', () => {
    const categoryKeys = new Set(CATEGORIES.map((c) => c.key));
    const specs = new Set(SPECIALTIES.map((s) => s.key));
    const cities = new Set(CITIES.map((c) => c.key));
    for (const d of DOCTORS) {
      expect(specs.has(d.specialty)).toBe(true);
      expect(cities.has(d.city)).toBe(true);
      expect(categoryKeys.has(doctorDraft(d).categories[0].key)).toBe(true);
    }
    expect(new Set(DOCTORS.map((d) => d.specialty)).size).toBe(7);
  });

  it('draft: published, en-US slug equals the name slug, bio is the description, no images', () => {
    const d = doctorDraft(DOCTORS[1]);
    expect(d.publish).toBe(true);
    expect(d.slug['en-US']).toBe('daniel-reyes');
    expect(d.description['en-US']).toContain('acne');
    expect(d.masterVariant).not.toHaveProperty('images');
  });
});

describe('doctor seeding', () => {
  it('creates 8 published doctor products with prices, then a second run changes nothing', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 };
    await runSteps(foundationSteps(ctx), () => {});
    const first = await runSteps(doctorSteps(ctx), () => {});
    expect(first).toMatchObject({ ok: true, changed: 8 });
    expect(fake.store.products).toHaveLength(8);
    expect(fake.store.products.every((p) => (p.masterData as { published: boolean }).published)).toBe(true);
    expect(await runSteps(doctorSteps(ctx), () => {})).toMatchObject({ ok: true, changed: 0 });
  });

  it('--only seeds one doctor; a changed fee is updated (changePrice) and published again', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 };
    expect(await runSteps(doctorSteps(ctx, { only: 'mlv-doc-amara-okafor' }), () => {})).toMatchObject({ changed: 1 });
    expect(fake.store.products).toHaveLength(1);
    const staged = ((fake.store.products[0].masterData as { staged: { masterVariant: { prices: { value: { centAmount: number } }[] } } }).staged);
    staged.masterVariant.prices[0].value.centAmount = 1;
    expect(await runSteps(doctorSteps(ctx, { only: 'mlv-doc-amara-okafor' }), () => {})).toMatchObject({ ok: true, changed: 1 });
    expect(fake.log.at(-1)).toMatchObject({ op: 'update', actions: ['changePrice', 'publish'] });
    expect(staged.masterVariant.prices[0].value.centAmount).not.toBe(1);
    expect(await runSteps(doctorSteps(ctx, { only: 'mlv-doc-amara-okafor' }), () => {})).toMatchObject({ ok: true, changed: 0 });
  });
});
