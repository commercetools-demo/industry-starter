/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TailoringInput } from '@/lib/catalog/tailoring-schema';
import { createFakeCommercetools, type FakeCommercetools } from '@/lib/portal/catalog-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: FakeCommercetools;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));

import { getTailoringDetail, listTailoring, resetTailoring, saveTailoring, tailoringDeps } from './tailoring';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const probe = vi.fn(async () => ({ width: 800, height: 800 }));

beforeEach(() => {
  fake = createFakeCommercetools();
  clearCatalogCaches();
  probe.mockClear();
  tailoringDeps.probe = probe;
});

const pid = (sku: string) => fake.ids.sku(sku);
const tailoring = (store: string, sku: string) => fake.state.tailorings.get(`${store}/${pid(sku)}`);

describe('TailoringInput schema', () => {
  const ok = { storeKey: NORTH, name: { 'de-DE': 'Name' } };
  it('strict schema rejects sku, fitment, slug', () => {
    expect(TailoringInput.safeParse(ok).success).toBe(true);
    for (const extra of [{ sku: 'X' }, { fitment: [] }, { slug: { 'de-DE': 'x' } }, { specs: {} }, { attributes: [] }]) {
      expect(TailoringInput.safeParse({ ...ok, ...extra }).success).toBe(false);
    }
  });

  it('more than 10 images, non-https url, url with credentials, query string or fragment are rejected', () => {
    const image = (url: string) => ({ storeKey: NORTH, images: [{ url }] });
    expect(TailoringInput.safeParse({ storeKey: NORTH, images: Array.from({ length: 11 }, (_, i) => ({ url: `https://cdn.example/${i}.jpg` })) }).success).toBe(false);
    expect(TailoringInput.safeParse({ storeKey: NORTH, images: Array.from({ length: 10 }, (_, i) => ({ url: `https://cdn.example/${i}.jpg` })) }).success).toBe(true);
    for (const bad of ['http://cdn.example/a.jpg', 'https://user:pw@cdn.example/a.jpg', 'https://cdn.example/a.jpg?w=100', 'https://cdn.example/a.jpg#x', 'javascript:alert(1)', 'not a url']) {
      expect(TailoringInput.safeParse(image(bad)).success).toBe(false);
    }
    expect(TailoringInput.safeParse(image('https://cdn.example/a.jpg')).success).toBe(true);
  });

  it('only de-DE and en-US shaped locale keys are accepted', () => {
    expect(TailoringInput.safeParse({ storeKey: NORTH, name: { german: 'x' } }).success).toBe(false);
  });
});

describe('saveTailoring', () => {
  it('create: publishes at once with name, description and images; no review record is written', async () => {
    await saveTailoring(NORTH, pid('MLV-OF-44002'), { name: { 'de-DE': 'Diesel-Ölfilter für Dauerläufer' }, images: [{ url: 'https://cdn.example/a.jpg' }] }, 'Alex');
    const create = fake.callsOf('tailoring.create')[0]?.args as Record<string, unknown>;
    expect(create).toMatchObject({ publish: true, product: { typeId: 'product', id: pid('MLV-OF-44002') }, variants: [{ sku: 'MLV-OF-44002', images: [{ url: 'https://cdn.example/a.jpg', dimensions: { w: 800, h: 800 } }] }] });
    expect(tailoring(NORTH, 'MLV-OF-44002')).toMatchObject({ published: true, hasStagedChanges: false });
    expect(fake.callsOf('object.write')).toHaveLength(0);
  });

  it('save sets staged name, description and images and publishes in the same request; no unpublish; no review record', async () => {
    await saveTailoring(NORTH, pid('MLV-BP-41001'), { name: { 'de-DE': 'Neuer Name' }, description: { 'de-DE': 'Neue Beschreibung' }, images: [{ url: 'https://cdn.example/new.jpg', label: 'Front' }] }, 'Alex');
    const updates = fake.callsOf('tailoring.update');
    expect(updates).toHaveLength(1);
    const actions = (updates[0]?.args as { actions: { action: string }[] }).actions.map((a) => a.action);
    expect(actions).toEqual(['setName', 'setDescription', 'setImages', 'publish']);
    expect(actions).not.toContain('unpublish');
    const t = tailoring(NORTH, 'MLV-BP-41001');
    expect(t).toMatchObject({ published: true, hasStagedChanges: false });
    expect(t?.current.variants[0].images[0]).toMatchObject({ url: 'https://cdn.example/new.jpg', label: 'Front' });
    expect(fake.callsOf('object.write')).toHaveLength(0);
    expect(fake.writes().every((w) => w.op.startsWith('tailoring.'))).toBe(true);
  });

  it('untailored languages are filled with the master text and show as untailored in the detail', async () => {
    await saveTailoring(NORTH, pid('MLV-BD-42001'), { description: { 'de-DE': 'Nur deutsch' } }, 'Alex');
    const stored = tailoring(NORTH, 'MLV-BD-42001')?.current.description;
    expect(stored['de-DE']).toBe('Nur deutsch');
    expect(Object.keys(stored)).toEqual(['de-DE']); // master has no en-US description: nothing to fill with
    await saveTailoring(NORTH, pid('MLV-BP-41001'), { name: { 'de-DE': 'Nur der deutsche Name' } }, 'Alex');
    const name = tailoring(NORTH, 'MLV-BP-41001')?.current.name;
    expect(name).toEqual({ 'de-DE': 'Nur der deutsche Name', 'en-US': 'Front brake pads, ceramic' });
    const detail = await getTailoringDetail(NORTH, pid('MLV-BP-41001'));
    expect(detail.tailoredLocales).toEqual(['de-DE']);
  });

  it('language outside store languages is refused', async () => {
    await expect(saveTailoring(NORTH, pid('MLV-BP-41001'), { name: { 'fr-FR': 'Plaquettes' } }, 'Alex')).rejects.toMatchObject({ status: 400, code: 'LANGUAGE_NOT_IN_STORE' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('a part outside the assortment cannot be tailored', async () => {
    await expect(saveTailoring(NORTH, pid('MLV-EX-52001'), { name: { 'de-DE': 'x' } }, 'Alex')).rejects.toMatchObject({ code: 'NOT_IN_ASSORTMENT' });
    await expect(saveTailoring(NORTH, pid('SK-2002'), { name: { 'de-DE': 'x' } }, 'Alex')).rejects.toMatchObject({ code: 'NOT_IN_ASSORTMENT' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('known image urls are not probed again; a new url is probed once', async () => {
    await saveTailoring(NORTH, pid('MLV-BP-41001'), { images: [{ url: 'https://images.example.test/tailored/north-41001.jpg' }, { url: 'https://cdn.example/second.jpg' }] }, 'Alex');
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith('https://cdn.example/second.jpg');
  });

  it('a rejected image (probe throws) writes nothing', async () => {
    probe.mockRejectedValueOnce(Object.assign(new Error('Use a JPG'), { status: 400, code: 'IMAGE_INVALID' }));
    await expect(saveTailoring(NORTH, pid('MLV-BP-41001'), { images: [{ url: 'https://cdn.example/bad.jpg' }] }, 'Alex')).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('409 retries with the latest version', async () => {
    fake.conflictOnce('tailoring.update');
    await saveTailoring(NORTH, pid('MLV-BP-41001'), { name: { 'de-DE': 'Neu' } }, 'Alex');
    const versions = fake.callsOf('tailoring.update').map((c) => (c.args as { version: number }).version);
    expect(versions[1]).toBeGreaterThan(versions[0]);
  });

  it('removing every field resets: use master images clears only the images', async () => {
    await saveTailoring(NORTH, pid('MLV-BP-41001'), { name: { 'de-DE': 'Küstenwerk Bremsbeläge vorn, Keramik' }, description: { 'de-DE': 'Leise und staubarm.' } }, 'Alex');
    expect(tailoring(NORTH, 'MLV-BP-41001')?.current.variants).toEqual([]);
    expect(tailoring(NORTH, 'MLV-BP-41001')?.current.name['de-DE']).toBe('Küstenwerk Bremsbeläge vorn, Keramik');
    await saveTailoring(NORTH, pid('MLV-BP-41001'), {}, 'Alex');
    expect(tailoring(NORTH, 'MLV-BP-41001')).toBeUndefined();
  });

  it("another store's tailoring is never touched", async () => {
    await saveTailoring(SOUTH, pid('MLV-BD-42001'), { name: { 'de-DE': 'Südkamm Scheibe' } }, 'Sam');
    expect(tailoring(NORTH, 'MLV-BD-42001')).toBeUndefined();
    expect(tailoring(SOUTH, 'MLV-BD-42001')).toBeDefined();
  });
});

describe('reset and reads', () => {
  it('reset deletes tailoring; the Tailored chip disappears', async () => {
    expect((await listTailoring(NORTH, { offset: 0, limit: 50 })).rows.find((r) => r.sku === 'MLV-BP-41001')?.tailored).toBe(true);
    await resetTailoring(NORTH, pid('MLV-BP-41001'));
    expect(tailoring(NORTH, 'MLV-BP-41001')).toBeUndefined();
    expect((await listTailoring(NORTH, { offset: 0, limit: 50 })).rows.find((r) => r.sku === 'MLV-BP-41001')?.tailored).toBe(false);
    fake.resetCalls();
    await resetTailoring(NORTH, pid('MLV-BP-41001')); // nothing left: no delete call
    expect(fake.writes()).toHaveLength(0);
  });

  it('list shows the tailored chip, the locales and the images chip', async () => {
    const { rows, total } = await listTailoring(NORTH, { offset: 0, limit: 50 });
    expect(total).toBe(7);
    expect(rows.find((r) => r.sku === 'MLV-BP-41001')).toMatchObject({ tailored: true, tailoredLocales: ['de-DE'], hasTailoredImages: true });
    expect(rows.find((r) => r.sku === 'MLV-AF-45001')).toMatchObject({ tailored: false, tailoredLocales: [], hasTailoredImages: false });
    expect((await listTailoring(SOUTH, { offset: 0, limit: 50 })).rows.find((r) => r.sku === 'MLV-OF-44001')).toMatchObject({ tailored: true, hasTailoredImages: false });
  });

  it('detail returns master and tailored values side by side, including images', async () => {
    const detail = await getTailoringDetail(NORTH, pid('MLV-BP-41001'));
    expect(detail.languages).toEqual(['de-DE', 'en-US']);
    expect(detail.master.name['en-US']).toBe('Front brake pads, ceramic');
    expect(detail.master.images[0]?.url).toBe('https://images.example.test/master/MLV-BP-41001.jpg');
    expect(detail.tailored.name['de-DE']).toBe('Küstenwerk Bremsbeläge vorn, Keramik');
    expect(detail.tailored.images[0]?.url).toBe('https://images.example.test/tailored/north-41001.jpg');
    await expect(getTailoringDetail(NORTH, pid('MLV-EX-52001'))).rejects.toMatchObject({ code: 'NOT_IN_ASSORTMENT' });
  });
});
