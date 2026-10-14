/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { main, planAddonImages, wantedAddonImages } from './addon-images';
import { buildManifest } from './manifest';
import { FakeCt } from './test/fake-ct';
import { main as seed } from './seed';

const KEY = 'spec-test-b2c-telecom';
const SOURCE = { CTP_SEED_PROJECT_KEY: KEY };
const CONFIRM = ['--confirm-project', KEY];
let api: FakeCt;
let lines: string[];
const log = (line: string): void => void lines.push(line);

const imagesOf = (key: string): string[] => ((api.byKey('products', key) as unknown as { masterData: { staged: { masterVariant: { images?: { url: string }[] } } } }).masterData.staged.masterVariant.images ?? []).map((image) => image.url);

beforeEach(async () => {
  lines = [];
  api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
  await seed(['--confirm-project', KEY, '--no-wait'], { api, source: SOURCE, manifest: buildManifest(), log: () => undefined });
});

describe('seed:addon-images', () => {
  it('every add-on has a recorded photo', () => {
    const wanted = wantedAddonImages();
    expect(wanted).toHaveLength(11);
    for (const entry of wanted) expect(entry.images.length, entry.key).toBeGreaterThan(0);
  });

  it('an already seeded project needs no change', async () => {
    expect((await planAddonImages(api)).every((plan) => plan.status === 'ok')).toBe(true);
    expect(await main([], { api, source: SOURCE, log })).toBe(0);
    expect(lines.every((line) => line.startsWith('unchanged'))).toBe(true);
  });

  describe('with the pictures gone from the project', () => {
    beforeEach(async () => {
      for (const { key, sku } of wantedAddonImages()) {
        const existing = api.byKey('products', key) as unknown as { key: string; version: number };
        const urls = imagesOf(key);
        await api.post(`products/key=${key}`, { version: existing.version, actions: urls.map((imageUrl) => ({ action: 'removeImage', sku, imageUrl })) });
      }
    });

    it('is read-only by default: lists what would change and writes nothing', async () => {
      expect(await main([], { api, source: SOURCE, log })).toBe(0);
      expect(lines.filter((line) => line.startsWith('would set'))).toHaveLength(11);
      expect(imagesOf('malva-offer-spotify')).toEqual([]);
    });

    it('--execute needs the project confirmation; with it every add-on gets its pictures, and a second run changes nothing', async () => {
      expect(await main(['--execute'], { api, source: SOURCE, log })).not.toBe(0);
      expect(imagesOf('malva-offer-spotify')).toEqual([]);
      expect(await main(['--execute', ...CONFIRM], { api, source: SOURCE, log })).toBe(0);
      for (const entry of wantedAddonImages()) expect(imagesOf(entry.key), entry.key).toEqual(entry.images.map((image) => image.url));
      lines = [];
      expect(await main(['--execute', ...CONFIRM], { api, source: SOURCE, log })).toBe(0);
      expect(lines.every((line) => line.startsWith('unchanged'))).toBe(true);
    });
  });

  it('an add-on that is not in the project is reported, not created', async () => {
    const empty = new FakeCt();
    expect(await main([], { api: empty, source: SOURCE, log })).not.toBe(0);
    expect(lines.filter((line) => line.startsWith('missing'))).toHaveLength(11);
  });
});
