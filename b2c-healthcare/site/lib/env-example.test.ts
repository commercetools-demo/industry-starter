import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const text = readFileSync(resolve(import.meta.dirname, '../.env.example'), 'utf8');

/** Parses "#   scope_a / scope_b     reason" lines of the scope justification block. */
function documentedScopes(): Array<{ scopes: string[]; reason: string }> {
  const out: Array<{ scopes: string[]; reason: string }> = [];
  for (const line of text.split('\n')) {
    const m = /^#\s{2,}((?:(?:view|manage)_[a-z_]+)(?:\s*\/\s*(?:view|manage)_[a-z_]+)*)\s{2,}(\S.*)$/.exec(line);
    if (m) out.push({ scopes: m[1].split('/').map((s) => s.trim()), reason: m[2].trim() });
  }
  return out;
}

describe('storefront-bff-and-session: Least-privilege API client', () => {
  it('Scope review: every scope in .env.example has a reason comment', () => {
    const docs = documentedScopes();
    expect(docs.length).toBeGreaterThan(5);
    for (const d of docs) expect(d.reason.length, d.scopes.join()).toBeGreaterThan(8);
  });

  it('Scope review: every scope token mentioned in a comment is on a documented line', () => {
    const inComments = new Set(text.split('\n').filter((l) => l.startsWith('#')).flatMap((l) => l.match(/\b(?:view|manage)_[a-z_]+/g) ?? []));
    const documented = new Set(documentedScopes().flatMap((d) => d.scopes));
    const reasonWords = new Set(
      documentedScopes().flatMap((d) => d.reason.match(/\b(?:view|manage)_[a-z_]+/g) ?? []),
    );
    for (const s of inComments) expect(documented.has(s) || reasonWords.has(s), s).toBe(true);
  });

  it('Scope review: spec scopes are present and no admin scope is requested', () => {
    const documented = new Set(documentedScopes().flatMap((d) => d.scopes));
    expect(documented.has('manage_sessions')).toBe(true);
    expect(documented.has('manage_orders')).toBe(true);
    expect(documented.has('manage_project')).toBe(false);
    expect([...documented].some((s) => s === 'manage_project_settings' || s.startsWith('manage_api_clients'))).toBe(false);
  });

  it('Scope review: any scope listed in the CTP_SCOPES line is documented', () => {
    const value = /^CTP_SCOPES=(.*)$/m.exec(text)?.[1] ?? '';
    const documented = new Set(documentedScopes().flatMap((d) => d.scopes));
    for (const token of value.split(/\s+/).filter(Boolean)) {
      expect(documented.has(token.split(':')[0]), token).toBe(true);
    }
  });
});
