// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// The editor package imports Puck's stylesheet, which the node test runner cannot load; only its default config is needed.
vi.mock('@commercetools-demo/puck-editor', () => ({
  defaultPuckConfig: { components: { Hero: { render: () => null }, RichText: { render: () => null }, Grid: { render: () => null } }, categories: { basic: { components: ['Hero'] } } },
}));

import { AUTOMOTIVE_BLOCKS, DEFAULTS } from './blocks-contract';
import { portalPuckConfig } from './puck-config';

const storefrontContract = path.resolve(process.cwd(), '..', 'storefront', 'lib', 'puck', 'automotive-blocks.schema.ts');

describe('portalPuckConfig', () => {
  it('registers the six automotive blocks next to the default blocks', () => {
    for (const name of AUTOMOTIVE_BLOCKS) expect(portalPuckConfig.components[name], name).toBeDefined();
    expect(Object.keys(portalPuckConfig.components).length).toBeGreaterThan(AUTOMOTIVE_BLOCKS.length);
    expect(portalPuckConfig.categories?.automotive?.components).toEqual([...AUTOMOTIVE_BLOCKS]);
  });

  it('every block has default props equal to the contract defaults', () => {
    for (const name of AUTOMOTIVE_BLOCKS) expect(portalPuckConfig.components[name].defaultProps).toEqual(DEFAULTS[name]);
  });

  it('block types equal the storefront contract when the contract file exists', () => {
    if (!existsSync(storefrontContract)) return; // K has not published it yet (TODO M-U-3)
    const text = readFileSync(storefrontContract, 'utf8');
    const list = /AUTOMOTIVE_BLOCKS\s*=\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '';
    const names = [...list.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
    expect(names).toEqual([...AUTOMOTIVE_BLOCKS]);
  });
});
