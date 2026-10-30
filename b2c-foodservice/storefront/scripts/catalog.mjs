#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
/**
 * Catalog CI client: validate / push / publish `page-builder.catalog.json` against the page-builder service. No dependencies.
 *
 *   node scripts/catalog.mjs validate   # change requests: nothing is written
 *   node scripts/catalog.mjs push       # write the catalog as a draft (idempotent). WRITES into the commercetools project
 *   node scripts/catalog.mjs publish    # go live. WRITES into the commercetools project. Run after the storefront deploy succeeded
 *
 * Env: PB_SERVICE_URL (including /service), PB_ADMIN_SECRET (CI secret store only; never the storefront's environment).
 * For local runs `.env.local` and `.env` are read too; variables already in the environment win.
 * push sends only the component types the storefront has a component for (the rest are held back and listed), because a
 * published type the live site cannot draw lets an author place something that renders nothing. Each phase of the rollout
 * adds its components to the map and the next push offers them to authors.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = join(ROOT, 'page-builder.catalog.json');
const MAP_FILE = join(ROOT, 'components', 'page-builder', 'component-map.ts');
export const COMMANDS = ['validate', 'push', 'publish'];

/** Type keys of the `catalogComponents` object literal in the component map (`'ns/name': Component,`). */
export function mappedTypes(source) {
  const start = source.indexOf('catalogComponents');
  const open = source.indexOf('{', source.indexOf('=', start));
  const close = source.indexOf('\n};', open);
  return [...source.slice(open, close).matchAll(/^\s*'([a-z0-9-]+\/[a-z0-9-]+)'\s*:/gm)].map((m) => m[1]);
}

/** Catalog component types that no component is mapped for. */
export function unmappedTypes(catalog, mapSource) {
  const mapped = new Set(mappedTypes(mapSource));
  return catalog.components.components.map((c) => c.type).filter((t) => !mapped.has(t));
}

/** The catalog to push: the same, without the component types that have no component. */
export function pushable(catalog, mapSource) {
  const held = new Set(unmappedTypes(catalog, mapSource));
  return { ...catalog, components: { ...catalog.components, components: catalog.components.components.filter((c) => !held.has(c.type)) } };
}

function fail(message) {
  console.error(`pb: ${message}`);
  process.exit(1);
}

async function main(command) {
  if (!COMMANDS.includes(command)) fail(`usage: catalog.mjs <${COMMANDS.join('|')}>`);
  // Plain node does not read Next's env files. Load them for local runs; variables already set (CI) win.
  for (const file of ['.env.local', '.env']) {
    if (existsSync(join(ROOT, file))) process.loadEnvFile(join(ROOT, file));
  }
  const base = process.env.PB_SERVICE_URL?.replace(/\/+$/, '');
  const secret = process.env.PB_ADMIN_SECRET;
  if (!base) fail('PB_SERVICE_URL is not set');
  if (!secret) fail('PB_ADMIN_SECRET is not set');

  const full = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'));
  let catalog = full;
  if (command === 'push') {
    if (!existsSync(MAP_FILE)) fail('components/page-builder/component-map.ts not found');
    const source = readFileSync(MAP_FILE, 'utf8');
    const held = unmappedTypes(full, source);
    if (held.length) console.warn(`held back (no component yet): ${held.join(', ')}`);
    catalog = pushable(full, source);
  }

  async function call(path, body) {
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      fail(`cannot reach the service: ${err.message}`);
    }
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  if (command === 'publish') {
    const { status, json } = await call('/v1/catalog/publish');
    if (status !== 200) fail(`publish failed (${status}): ${json.error?.message ?? JSON.stringify(json)}`);
    console.log(`published catalog appVersion ${json.appVersion} at ${json.publishedAt}`);
    return;
  }
  const { status, json } = await call(command === 'validate' ? '/v1/catalog/validate' : '/v1/catalog', catalog);
  for (const w of json.warnings ?? []) console.warn(`warning: ${w}`);
  for (const e of json.errors ?? []) console.error(`error: ${e}`);
  if (status === 422) fail('catalog is invalid; nothing was written');
  if (status !== 200) fail(`${command} failed (${status}): ${json.error?.message ?? JSON.stringify(json)}`);
  console.log(command === 'validate' ? 'catalog is valid' : `catalog ${json.status} (appVersion ${json.appVersion})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv[2]);
