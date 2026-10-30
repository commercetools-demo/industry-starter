import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RESERVED_SEGMENTS, isReservedPath } from '@/lib/page-builder/reserved';

const m = vi.hoisted(() => ({ outcome: { kind: 'none' } as { kind: string; node?: unknown }, renderPage: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => {} }));
vi.mock('@/components/page-builder/renderPage', () => ({
  renderPage: async (...args: unknown[]) => {
    m.renderPage(...args);
    return m.outcome;
  },
}));
vi.mock('@/components/error/ErrorPage', () => ({ default: ({ kind }: { kind: string }) => <p data-kind={kind} /> }));

import CatchAllPage from '@/app/[locale]/[...rest]/page';

const call = (rest: string[], sp?: Record<string, string>) =>
  CatchAllPage({ params: Promise.resolve({ locale: 'en-US', rest }), ...(sp ? { searchParams: Promise.resolve(sp) } : {}) });

beforeEach(() => {
  m.renderPage.mockClear();
  m.outcome = { kind: 'none' };
});

describe('catch-all page', () => {
  it('draws an authored page', async () => {
    m.outcome = { kind: 'page', node: <h1>Spring</h1> };
    const ui = (await call(['spring-collection'])) as { props: { children: { props: { children: string } } } };
    expect(ui.props.children.props.children).toBe('Spring');
    expect(m.renderPage).toHaveBeenCalledWith({ locale: 'en-US', segments: ['spring-collection'] });
  });

  it('no page is the real not-found', async () => {
    await expect(call(['nothing-here'])).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('a failure is the degraded page, not a not-found', async () => {
    m.outcome = { kind: 'failed' };
    const ui = (await call(['spring-collection'])) as { props: { kind: string } };
    expect(ui.props.kind).toBe('server-error');
  });

  it('forwards the query string', async () => {
    m.outcome = { kind: 'page', node: null };
    await call(['x'], { pb_preview: 't' });
    expect(m.renderPage).toHaveBeenCalledWith({ locale: 'en-US', segments: ['x'], searchParams: { pb_preview: 't' } });
  });

  it('a reserved first segment is not-found without a render call', async () => {
    await expect(call(['cart', 'anything'])).rejects.toThrow('NEXT_NOT_FOUND');
    expect(m.renderPage).not.toHaveBeenCalled();
  });
});

describe('reserved paths', () => {
  const localeDir = join(process.cwd(), 'app', '[locale]');
  const routeDirs = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (!e.isDirectory()) return [];
      // route groups like (listing) add no segment
      return e.name.startsWith('(') ? routeDirs(join(dir, e.name)) : [e.name];
    });

  it('every reserved segment is a native route under app/[locale]', () => {
    const native = new Set(routeDirs(localeDir));
    expect(RESERVED_SEGMENTS.filter((s) => !native.has(s))).toEqual([]);
  });

  it('every native route is reserved, so a new native route cannot be shadowed by an author', () => {
    const catchAll = '[...rest]';
    const native = routeDirs(localeDir).filter((n) => n !== catchAll && existsSync(localeDir));
    expect(native.filter((n) => !(RESERVED_SEGMENTS as readonly string[]).includes(n))).toEqual([]);
  });

  it('matches case-insensitively and only on the first segment', () => {
    expect(isReservedPath(['Cart'])).toBe(true);
    expect(isReservedPath(['spring', 'cart'])).toBe(false);
    expect(isReservedPath([])).toBe(false);
  });
});
