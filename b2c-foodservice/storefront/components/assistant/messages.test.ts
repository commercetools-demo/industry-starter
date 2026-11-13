// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';
import { ACTIVITY_TOOLS } from './activity';

const ROOT = process.cwd();
const SOURCES = ['components/assistant', 'context/assistant-context.tsx'];

function walk(path: string, out: string[] = []): string[] {
  const full = join(ROOT, path);
  if (statSync(full).isDirectory()) {
    for (const name of readdirSync(full)) walk(join(path, name), out);
  } else if (/\.(ts|tsx)$/.test(path) && !/\.test\./.test(path) && !/fixtures/.test(path)) {
    out.push(path);
  }
  return out;
}

function lookup(catalogue: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), catalogue);
}

/** `useTranslations('ns')` then every `t('key')` literal in the file, as `ns.key`. */
function scrape(files: string[]): Set<string> {
  const keys = new Set<string>();
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const ns = /useTranslations\(\s*['"]([\w.]+)['"]\s*\)/.exec(text)?.[1];
    if (!ns) continue;
    for (const m of text.matchAll(/\bt(?:\.rich)?\(\s*['"]([\w.]+)['"]/g)) keys.add(`${ns}.${m[1]}`);
  }
  return keys;
}

// Computed key sets, listed explicitly: the activity line per tool, and the starter chips.
const COMPUTED = [
  ...ACTIVITY_TOOLS.map((tool) => `assistant.activity.${tool}`),
  'assistant.activity.generic',
  'assistant.activity.compose',
  ...['starter1', 'starter2', 'starter3', 'starter4'].map((k) => `assistant.starters.${k}`),
];

describe('assistant messages', () => {
  const keys = new Set([...scrape(SOURCES.flatMap((s) => walk(s))), ...COMPUTED]);

  it('Every assistant key exists in both catalogues', () => {
    const missing = [...keys].filter((k) => lookup(enUS, k) === undefined || lookup(enCA, k) === undefined);
    expect(missing).toEqual([]);
  });

  it('Both catalogues define the same assistant keys', () => {
    const flat = (node: unknown, prefix = ''): string[] =>
      node && typeof node === 'object' ? Object.entries(node).flatMap(([k, v]) => flat(v, `${prefix}${k}.`)) : [prefix.slice(0, -1)];
    expect(flat((enCA as Record<string, unknown>).assistant).sort()).toEqual(flat((enUS as Record<string, unknown>).assistant).sort());
  });

  it('scrapes at least the panel keys (guards the scraper itself)', () => {
    expect([...keys]).toEqual(expect.arrayContaining(['assistant.panel.title', 'assistant.composer.send', 'assistant.latest']));
  });
});
