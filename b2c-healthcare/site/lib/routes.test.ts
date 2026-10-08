// @vitest-environment node
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOOTER_COLUMNS } from './nav';
import { JOURNAL_PATH, POLICY_PATHS, STATIC_PAGE_PATHS, contentSitemapEntries, showJournal } from './routes';

const appDir = join(import.meta.dirname, '..', 'app', '[locale]');

/** Locale-less route patterns of every page.tsx under app/[locale] (`[slug]` segments are wildcards). */
function pagePatterns(dir: string = appDir): string[][] {
  const out: string[][] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(current, entry.name));
      else if (entry.name === 'page.tsx') {
        const segments = relative(dir, current).split(sep).filter(Boolean);
        if (!segments.some((segment) => segment.startsWith('%5F') || segment.startsWith('_') || segment.startsWith('[...'))) out.push(segments);
      }
    }
  };
  walk(dir);
  return out;
}

function routeExists(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  return pagePatterns().some(
    (pattern) => pattern.length === parts.length && pattern.every((segment, i) => /^\[[^\]]+\]$/.test(segment) || segment === parts[i]),
  );
}

// Care and Pharmacy pages belong to other workstreams (doctor list, prescriptions, labs) and may not be
// merged yet; the Company links belong to this workstream and must always resolve.
const OTHER_WORKSTREAMS = new Set(['/doctors/remote', '/doctors/office', '/prescriptions', '/account/labs']);

describe('faq › footer and content routes', () => {
  it('every live footer link resolves to an existing page (those of other workstreams are exempt until merged)', () => {
    const live = FOOTER_COLUMNS.flatMap((column) => column.links.filter((link) => link.live).map((link) => link.href));
    for (const href of live) {
      if (OTHER_WORKSTREAMS.has(href)) continue;
      expect(routeExists(href), href).toBe(true);
    }
    const company = FOOTER_COLUMNS.find((column) => column.headingKey === 'company')?.links.map((link) => link.href);
    expect(company).toEqual(expect.arrayContaining(['/about', '/contact', '/faq', ...POLICY_PATHS]));
  });

  it('the route helper itself rejects a missing page and accepts dynamic ones', () => {
    expect(routeExists('/nope')).toBe(false);
    expect(routeExists('/journal/anything')).toBe(true);
    expect(routeExists('/policies/terms')).toBe(true);
  });

  it('every static content path and the journal have a page', () => {
    for (const path of [...STATIC_PAGE_PATHS, JOURNAL_PATH]) expect(routeExists(path), path).toBe(true);
  });

  it('the journal row and header link need three published articles; entries list each article once', () => {
    expect(showJournal('en-US')).toBe(true);
    const paths = contentSitemapEntries('en-US').map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
