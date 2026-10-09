import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILES } from './schema';
import { getSiteImage, IMAGE_SLOTS } from './images';

const read = (name: string) => JSON.parse(readFileSync(path.join(__dirname, `${name}.json`), 'utf8'));

describe('malva-homepage › Proof content is managed and never rendered empty', () => {
  it('every content file validates against its schema', () => {
    for (const [name, schema] of Object.entries(FILES)) expect(() => schema.parse(read(name)), name).not.toThrow();
  });
  it('every file has a German text for every localized field', () => {
    const missing: string[] = [];
    const walk = (node: unknown, where: string) => {
      if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${where}[${i}]`));
      else if (node && typeof node === 'object') {
        const o = node as Record<string, unknown>;
        if ('en-US' in o) { if (!o['de-DE']) missing.push(where); } else Object.entries(o).forEach(([k, v]) => walk(v, `${where}.${k}`));
      }
    };
    for (const name of Object.keys(FILES)) walk(read(name), name);
    expect(missing).toEqual([]);
  });
  it('has the verbatim design figures and the audience order facilities, manufacturing, property, healthcare', () => {
    expect(read('stats').map((s: { value: string }) => s.value)).toEqual(['4 h', '98.6%', '82%', '350+']);
    expect(read('audiences').map((a: { sector: string }) => a.sector)).toEqual(['facilities', 'manufacturing', 'property', 'healthcare']);
    expect(read('accreditations')).toHaveLength(4);
    expect(read('testimonials')).toHaveLength(3);
    expect(read('contact').emergency.display).toBe('0800 555 0142');
  });
  it('rejects an audience with an unknown sector and an item without a sample flag', () => {
    expect(FILES.audiences.safeParse([{ id: 'x', sector: 'other', title: { 'en-US': 'a' }, body: { 'en-US': 'b' }, sample: true }]).success).toBe(false);
    expect(FILES.stats.safeParse([{ id: 'x', value: '1', caption: { 'en-US': 'a' } }]).success).toBe(false);
  });
});

describe('malva-homepage › Homepage performance and discoverability (images)', () => {
  it('every slot has a clean photo URL with intrinsic dimensions', () => {
    for (const slot of IMAGE_SLOTS) {
      const image = getSiteImage(slot);
      expect(image, slot).toBeDefined();
      expect(image!.url).toMatch(/^https:\/\/images\.pexels\.com\//);
      expect(image!.url).not.toMatch(/[?#]/);
      expect(image!.width).toBeGreaterThan(0);
      expect(image!.height).toBeGreaterThan(0);
    }
  });
  it('lists only json files next to the schema (no stray content)', () => {
    expect(readdirSync(__dirname).filter((f) => f.endsWith('.json')).sort()).toEqual(['accreditations.json', 'audiences.json', 'contact.json', 'site-images.json', 'stats.json', 'testimonials.json']);
  });
});
