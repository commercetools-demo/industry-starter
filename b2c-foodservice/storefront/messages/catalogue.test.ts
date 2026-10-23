import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG } from '@/lib/utils';

const ROOT = process.cwd();
const LOCALES = Object.keys(COUNTRY_CONFIG);

function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8'));
}

function flatten(value: unknown, prefix = ''): Array<[string, string]> {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [[prefix, String(value)]];
}

describe('Message catalogues', () => {
  it('Catalogues have identical keys', () => {
    const keys = (l: string) => flatten(load(l)).map(([k]) => k).sort();
    const reference = keys('en-US');
    for (const locale of LOCALES) expect(keys(locale), locale).toEqual(reference);
  });

  it('The base namespaces exist', () => {
    for (const ns of ['common', 'ui', 'a11y', 'errors']) expect(load('en-US'), ns).toHaveProperty([ns]);
  });

  it('en-CA uses Canadian spelling where the text has colour or favourite', () => {
    const us = Object.fromEntries(flatten(load('en-US')));
    const ca = Object.fromEntries(flatten(load('en-CA')));
    expect(ca['common.colour']).toBe('Colour');
    expect(ca['common.favourite']).toBe('Favourite');
    for (const [key, value] of Object.entries(ca)) {
      expect(value, `en-CA ${key}`).not.toMatch(/\b(color|favorite|dialog)s?\b/i);
    }
    expect(us['common.colour']).toBe('Color');
  });

  it('ICU messages parse in both locales', () => {
    for (const locale of LOCALES) {
      const t = createTranslator({
        locale,
        messages: load(locale) as never,
        namespace: 'ui.rating' as never,
      }) as unknown as (key: string, values: Record<string, unknown>) => string;
      expect(t('label', { value: '4.6', count: 0 })).toBe('4.6 out of 5, 0 reviews');
      expect(t('label', { value: '4.6', count: 1 })).toBe('4.6 out of 5, 1 review');
      expect(t('label', { value: '4.6', count: 12 })).toBe('4.6 out of 5, 12 reviews');
      expect(t('reviews', { count: 1 })).toBe('1 review');
    }
  });

  it('Nespresso appears only in compatibility wording', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of flatten(load(locale))) {
        const bare = value.replace(/Nespresso (Original|Vertuo)/g, '');
        expect(bare, `${locale} ${key}`).not.toMatch(/nespresso/i);
      }
    }
  });

  it('Every ErrorCode of lib/errors has an errors.<code> key', () => {
    const file = join(ROOT, 'lib', 'errors.ts');
    // D owns lib/errors.ts; until it is merged, check against the codes listed in its workstream (D-server-core 3.3).
    let codes = [
      'bad_request', 'validation_failed', 'unauthorized', 'forbidden', 'not_found', 'conflict',
      'rate_limited', 'upstream_unavailable', 'wrong_project', 'internal_error',
    ];
    if (existsSync(file)) {
      const src = readFileSync(file, 'utf8');
      const union = /export type ErrorCode\s*=([^;]+);/.exec(src);
      if (union) codes = [...union[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    }
    const errors = load('en-US').errors as Record<string, string>;
    for (const code of codes) expect(errors, code).toHaveProperty([code]);
  });

  it('No catalogue value contains a hex colour or HTML tag', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of flatten(load(locale))) {
        expect(value, `${locale} ${key}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(value, `${locale} ${key}`).not.toMatch(/<\/?[a-z][^>]*>/i);
      }
    }
  });
});
