// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScopeBlocks } from '@/scripts/check-secrets.mjs';
import { ADMIN_SCOPES, FRONTEND_SCOPES, PROVISION_SCOPES, type ScopeDoc } from './scopes';

const example = readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');

/** `# <scope> : <reason>` lines per `*_SCOPES` block of `.env.example`, with their reasons. */
function documented(): Record<string, ScopeDoc[]> {
  const out: Record<string, ScopeDoc[]> = {};
  let comments: string[] = [];
  for (const line of example.split('\n')) {
    if (line.startsWith('#')) {
      comments.push(line);
      continue;
    }
    const m = /^([A-Z_]*_SCOPES)=/.exec(line);
    if (m) {
      out[m[1]] = comments.flatMap((c) => {
        const s = /^#\s*((?:view|manage|create)_[a-z_]+)\s*:\s*(.*)$/.exec(c);
        return s ? [{ scope: s[1], reason: s[2].trim() }] : [];
      });
    }
    comments = [];
  }
  return out;
}

const blocks = documented();
const sets: [string, readonly ScopeDoc[]][] = [
  ['CTP_SCOPES', FRONTEND_SCOPES],
  ['CTP_ADMIN_SCOPES', ADMIN_SCOPES],
  ['CTP_PROVISION_SCOPES', PROVISION_SCOPES],
];

describe('Environment and least privilege: scope registry', () => {
  it.each(sets)('Scope used by code but missing from .env.example fails (%s)', (name, registry) => {
    const inExample = new Set((blocks[name] ?? []).map((s) => s.scope));
    expect(registry.filter((s) => !inExample.has(s.scope)).map((s) => s.scope)).toEqual([]);
  });

  it.each(sets)('Scope in .env.example but unused fails (%s)', (name, registry) => {
    const inRegistry = new Set(registry.map((s) => s.scope));
    expect((blocks[name] ?? []).filter((s) => !inRegistry.has(s.scope)).map((s) => s.scope)).toEqual([]);
  });

  it.each(sets)('Every scope has a reason, identical in both places (%s)', (name, registry) => {
    for (const s of registry) {
      expect(s.reason.trim().length).toBeGreaterThan(8);
      expect(blocks[name]?.find((d) => d.scope === s.scope)?.reason).toBe(s.reason);
    }
  });

  it('The example has no scope problems and no duplicates', () => {
    expect(parseScopeBlocks(example).problems).toEqual([]);
    for (const [, registry] of sets) expect(new Set(registry.map((s) => s.scope)).size).toBe(registry.length);
  });

  it('No manage_project anywhere', () => {
    for (const [, registry] of sets) expect(registry.map((s) => s.scope)).not.toContain('manage_project');
    expect(example).not.toMatch(/manage_project/);
  });

  it('Provisioning has no admin scopes', () => {
    const admin = new Set(ADMIN_SCOPES.map((s) => s.scope));
    expect(PROVISION_SCOPES.filter((s) => admin.has(s.scope))).toEqual([]);
    expect(PROVISION_SCOPES.map((s) => s.scope)).not.toContain('manage_key_value_documents');
  });

  it('The frontend client has no admin scope', () => {
    expect(FRONTEND_SCOPES.map((s) => s.scope)).not.toContain('manage_key_value_documents');
  });

  it('The initial frontend scopes of the spec are all present', () => {
    const spec = ['view_project_settings', 'view_published_products', 'view_categories', 'view_stores', 'view_product_selections', 'view_associate_roles', 'view_types', 'manage_customers', 'manage_orders', 'manage_quotes', 'manage_quote_requests', 'view_quotes'];
    expect(FRONTEND_SCOPES.map((s) => s.scope)).toEqual(expect.arrayContaining(spec));
  });
});
