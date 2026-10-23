import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG } from '@/lib/utils';

const DIR = join(process.cwd(), 'messages');

function flatten(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

function keysOf(file: string): string[] {
  return flatten(JSON.parse(readFileSync(join(DIR, file), 'utf8'))).sort();
}

describe('Adding a market', () => {
  it('every COUNTRY_CONFIG key has a message file with the same keys', () => {
    const reference = keysOf('en-US.json');
    expect(reference.length).toBeGreaterThan(0);
    for (const locale of Object.keys(COUNTRY_CONFIG)) {
      expect(keysOf(`${locale}.json`), `${locale}.json`).toEqual(reference);
    }
  });

  it('no message file exists for a locale that is not in COUNTRY_CONFIG', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
    expect(files.sort()).toEqual(Object.keys(COUNTRY_CONFIG).map((l) => `${l}.json`).sort());
  });
});
