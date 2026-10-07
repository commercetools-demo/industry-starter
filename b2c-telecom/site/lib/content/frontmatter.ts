import { ContentError } from './types';

export type FrontMatterValue = string | string[];

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Parses the small YAML subset used by content files: `key: value` and `key: [a, b]` between two `---` lines.
 * A file without a leading `---` has no front matter (data is empty, the body is the whole file).
 */
export function parseFrontMatter(raw: string): { data: Record<string, FrontMatterValue>; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { data: {}, body: text };
  const lines = text.split('\n');
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) throw new ContentError('front matter is not closed with a --- line');
  const data: Record<string, FrontMatterValue> = {};
  for (const line of lines.slice(1, end)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!key) continue;
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item))
        .filter((item) => item.length > 0);
    } else {
      data[key] = unquote(value);
    }
  }
  return { data, body: lines.slice(end + 1).join('\n').replace(/^\n+/, '') };
}

/** Returns a required string key or throws `ContentError('<file>: missing <key>')`. */
export function requireString(data: Record<string, FrontMatterValue>, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value === '') throw new ContentError(`${file}: missing ${key}`);
  return value;
}

export function optionalString(data: Record<string, FrontMatterValue>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function stringList(data: Record<string, FrontMatterValue>, key: string): string[] {
  const value = data[key];
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value !== '' ? [value] : [];
}
