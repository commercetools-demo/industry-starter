// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { documentedScopes } from '@/scripts/check-secrets.mjs';
import { FRONTEND_SCOPES, type ScopeDoc } from './scopes';

/** Both directions of the drift check: registry scopes missing from the example, and example scopes the code does not use. */
function drift(registry: readonly ScopeDoc[], exampleText: string) {
  const documented = documentedScopes(exampleText);
  return {
    undocumented: registry.filter((s) => !documented.has(s.scope)).map((s) => s.scope),
    unused: [...documented.keys()].filter((k) => !registry.some((s) => s.scope === k)),
    reasonMismatch: registry.filter((s) => documented.has(s.scope) && documented.get(s.scope) !== s.reason).map((s) => s.scope),
  };
}

const example = readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');

describe('Environment and least privilege: scope registry', () => {
  it('Registry and .env.example agree in both directions', () => {
    expect(drift(FRONTEND_SCOPES, example)).toEqual({ undocumented: [], unused: [], reasonMismatch: [] });
  });

  it('Scope used by code but missing from .env.example fails', () => {
    const registry = [...FRONTEND_SCOPES, { scope: 'view_orders', reason: 'new feature' }];
    expect(drift(registry, example).undocumented).toEqual(['view_orders']);
  });

  it('Scope in .env.example but unused fails', () => {
    const text = `${example}\n# view_payments : never used\n`;
    expect(drift(FRONTEND_SCOPES, text).unused).toEqual(['view_payments']);
  });

  it('Every scope has a reason', () => {
    for (const s of FRONTEND_SCOPES) expect(s.reason.trim().length).toBeGreaterThan(5);
  });

  it('No scope is listed twice', () => {
    const names = FRONTEND_SCOPES.map((s) => s.scope);
    expect(new Set(names).size).toBe(names.length);
  });

  it('No manage_project anywhere', () => {
    expect(FRONTEND_SCOPES.some((s) => s.scope.startsWith('manage_project'))).toBe(false);
    expect(example).not.toMatch(/manage_project/);
  });

  it('Scopes are commercetools scope names', () => {
    for (const s of FRONTEND_SCOPES) expect(s.scope).toMatch(/^(view|manage|create)_[a-z_]+$/);
  });
});
