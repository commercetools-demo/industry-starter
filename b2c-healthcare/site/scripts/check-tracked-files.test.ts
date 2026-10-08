import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECRET_NAMES, forbiddenTracked, publicPrefixHits, scanTracked } from './check-tracked-files.mjs';

const siteRoot = resolve(import.meta.dirname, '..');
// Built by concatenation so this file does not trip its own scan.
const PREFIX = 'NEXT_PUBLIC' + '_';

describe('storefront-project-bootstrap: No public prefix on secrets', () => {
  it.each(SECRET_NAMES)('No public prefix on secrets: %s with a public prefix is detected', (name) => {
    expect(publicPrefixHits(`const x = process.env.${PREFIX}${name};`)).toContain(PREFIX + name);
  });

  it('No public prefix on secrets: unrelated public variables are fine', () => {
    expect(publicPrefixHits(`${PREFIX}SITE_NAME=Malva`)).toEqual([]);
  });

  it('No public prefix on secrets: no tracked file carries a public-prefixed secret', () => {
    const problems = scanTracked(siteRoot).filter((problem) => problem.includes('forbidden public variable'));
    expect(problems).toEqual([]);
  });
});

describe('storefront-project-bootstrap: Nothing committed', () => {
  it('Nothing committed: real env files and .next are flagged, the two examples are not', () => {
    expect(
      forbiddenTracked([
        '.env',
        '.env.local',
        '.env.seed.local',
        '.env.production',
        'sub/.env.local',
        '.next/build.json',
        'site/.next/x',
        '.env.example',
        '.env.seed.example',
        'app/page.tsx',
      ]),
    ).toEqual(['.env', '.env.local', '.env.seed.local', '.env.production', 'sub/.env.local', '.next/build.json', 'site/.next/x']);
  });

  it('Nothing committed: git ls-files holds no env file or build output', () => {
    expect(scanTracked(siteRoot).filter((problem) => problem.startsWith('tracked file'))).toEqual([]);
  });

  it('Nothing committed: .gitignore lists .env, .env.local and .next, and .env.example is present', () => {
    const ignore = readFileSync(resolve(siteRoot, '.gitignore'), 'utf8').split('\n');
    expect(ignore).toContain('.env*');
    expect(ignore).toContain('/.next/');
    expect(ignore).toContain('!.env.example');
    expect(existsSync(resolve(siteRoot, '.env.example'))).toBe(true);
  });

  it('.env.example names every variable without a value', () => {
    const lines = readFileSync(resolve(siteRoot, '.env.example'), 'utf8').split('\n');
    for (const name of SECRET_NAMES) expect(lines).toContain(`${name}=`);
  });
});
