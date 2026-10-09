// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSamples, run } from './check-sample-content.mjs';
import { syncSiteImages } from './sync-site-images.mjs';

const project = (files) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'malva-content-'));
  mkdirSync(path.join(root, 'content'));
  for (const [name, data] of Object.entries(files)) writeFileSync(path.join(root, 'content', name), JSON.stringify(data));
  return root;
};

describe('malva-homepage › Sample content is labelled (launch check)', () => {
  it('lists every sample-flagged item and passes in non-strict mode', () => {
    const root = project({ 'stats.json': [{ id: 'a', sample: true }, { id: 'b', sample: false }], 'contact.json': { sample: true } });
    expect(findSamples(root)).toEqual(['contact.json', 'stats.json[a]']);
    expect(run(root, false).failed).toBe(false);
  });
  it('--strict fails while any sample item remains and passes when none do', () => {
    expect(run(project({ 'stats.json': [{ id: 'a', sample: true }] }), true).failed).toBe(true);
    expect(run(project({ 'stats.json': [{ id: 'a', sample: false }] }), true).failed).toBe(false);
  });
  it('ignores site-images.json and a missing content folder', () => {
    expect(findSamples(project({ 'site-images.json': { 'home-hero': [{ url: 'x', sample: true }] } }))).toEqual([]);
    expect(findSamples(mkdtempSync(path.join(os.tmpdir(), 'malva-empty-')))).toEqual([]);
  });
});

describe('sync-site-images', () => {
  it('copies the seed picks and refuses unclean URLs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'malva-sync-'));
    const seed = path.join(root, 'seed', 'src', 'data');
    const site = path.join(root, 'site');
    mkdirSync(seed, { recursive: true });
    mkdirSync(site);
    writeFileSync(path.join(seed, 'site-images.json'), JSON.stringify({ 'home-hero': [{ url: 'https://images.pexels.com/photos/1/a.jpeg' }] }));
    expect(syncSiteImages(site)).toBe('copied');
    writeFileSync(path.join(seed, 'site-images.json'), JSON.stringify({ 'home-hero': [{ url: 'https://images.pexels.com/photos/1/a.jpeg?w=1' }] }));
    expect(() => syncSiteImages(site)).toThrow(/clean/);
  });
  it('keeps the committed copy when the seed folder is absent and fails when there is neither', () => {
    const root = project({ 'site-images.json': {} });
    expect(syncSiteImages(root)).toBe('kept');
    expect(() => syncSiteImages(mkdtempSync(path.join(os.tmpdir(), 'malva-none-')))).toThrow();
  });
});
