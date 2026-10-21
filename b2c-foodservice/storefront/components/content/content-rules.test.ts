import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG } from '@/lib/utils';

const ROOT = process.cwd();
const DIRS = ['components/content', 'components/contact', 'components/faq', 'components/journal', 'components/error'];

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir))
    .filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f))
    .map((f) => join(dir, f));
}

function flatten(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('Content namespaces', () => {
  it('catalogues have the same content keys', () => {
    const load = (l: string) => JSON.parse(readFileSync(join(ROOT, 'messages', `${l}.json`), 'utf8')) as Record<string, unknown>;
    const namespaces = ['content', 'about', 'contact', 'faq', 'policy', 'journal', 'error'];
    for (const ns of namespaces) {
      const reference = flatten(load('en-US')[ns]).sort();
      expect(reference.length, ns).toBeGreaterThan(0);
      for (const locale of Object.keys(COUNTRY_CONFIG)) expect(flatten(load(locale)[ns]).sort(), `${locale} ${ns}`).toEqual(reference);
    }
  });

  it('the D11 keys with exact text exist', () => {
    const us = JSON.parse(readFileSync(join(ROOT, 'messages/en-US.json'), 'utf8')) as Record<string, Record<string, unknown>>;
    expect(us.content.fallbackNotice).toBe('This page is shown in English because it is not available in {language} yet.');
    expect(us.content.draftBanner).toBe('This text is a draft and not final legal text.');
    expect(us.policy.effective).toBe('Effective from {date}');
    expect(us.error.notFound).toEqual({ title: "We can't find that page.", text: 'The address may be mistyped, or the product may no longer be available.' });
    expect(us.journal.empty).toBe('No articles match your filters.');
  });

  it('no hard coded strings in content components', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of sources(dir)) {
        const src = readFileSync(join(ROOT, file), 'utf8');
        // JSX text between tags that contains letters and is not an expression.
        for (const m of src.matchAll(/>\s*([^<>{}\n][^<>{}]*)\s*</g)) {
          const text = m[1].trim();
          if (/[A-Za-z]{2,}/.test(text) && !/^[=-]?>/.test(text) && !/=>|&&|\|\||\?|;|\(|\)/.test(text)) offenders.push(`${file}: ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the only page-level raw strings are the global-error dictionary', () => {
    const file = readFileSync(join(ROOT, 'components/error/global-error-dictionary.ts'), 'utf8');
    expect(file).toContain("'en-US'");
    expect(file).toContain("'en-CA'");
  });
});
