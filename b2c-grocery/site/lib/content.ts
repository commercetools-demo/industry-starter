import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

export interface ContentPage {
  title: string;
  description: string;
  /** Kicker text above the H1 (optional front matter `kicker`). */
  kicker?: string;
  /** Raw markdown body (front matter removed). */
  markdown: string;
  /** HTML rendered from the markdown. The files are repo-authored and trusted; never pass user input here. */
  html: string;
}

export const POLICY_SLUGS = ['delivery', 'returns', 'privacy', 'terms'] as const;

const CONTENT_ROOT = path.join(process.cwd(), 'content');
const SAFE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const LOCALE = /^[A-Za-z]{2}-[A-Za-z]{2}$/;

/** Tiny front-matter reader: a leading `---` block of `key: value` lines. */
export function parseFrontMatter(source: string): { data: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { data: {}, body: source };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    data[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, '$2');
  }
  return { data, body: source.slice(match[0].length) };
}

/** Reads `content/<locale>/<slug>.md`; `null` when the slug or locale is unknown or the file is missing. */
export async function getPage(slug: string, locale: string): Promise<ContentPage | null> {
  if (!SAFE.test(slug) || !LOCALE.test(locale)) return null;
  let source: string;
  try {
    source = await readFile(path.join(CONTENT_ROOT, locale, `${slug}.md`), 'utf8');
  } catch {
    return null;
  }
  const { data, body } = parseFrontMatter(source);
  return {
    title: data.title ?? slug,
    description: data.description ?? '',
    ...(data.kicker ? { kicker: data.kicker } : {}),
    markdown: body,
    html: await marked.parse(body),
  };
}
