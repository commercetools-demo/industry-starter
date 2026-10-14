/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
// An attribute defined on a product type but read nowhere is dead data (trial-days and price-steps were). Every defined attribute
// must be named by a storefront reader (lib, app, components), or be listed here with the reason it is kept.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST } from '.';
import type { ProductTypeDraft } from '../types';

const ROOT = join(__dirname, '..', '..', '..');
const KEPT_WITHOUT_READER: Record<string, string> = {
  'label-plan-id': 'the plan id printed on the Broadband Facts label; the label is built from the seeded product data and the id is a seed-side identifier',
  'bundle-discount-text': 'the "Discounts & Bundles" line of the Broadband Facts label (merchant text, shown as-is); revisit if bundle discounts stay retired',
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__fixtures__' || name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [readFileSync(path, 'utf8')] : [];
  });
}

describe('attribute consumers', () => {
  it('every attribute of every product type is read by the storefront or listed with a reason', () => {
    const code = ['lib', 'app', 'components'].flatMap((dir) => sources(join(ROOT, dir))).join('\n');
    const names = new Set((MANIFEST.productType as ProductTypeDraft[]).flatMap((type) => type.attributes.map((attribute) => attribute.name)));
    const dead = [...names].filter((name) => !code.includes(`'${name}'`) && !code.includes(`"${name}"`) && !code.includes(`\`${name}\``) && !(name in KEPT_WITHOUT_READER));
    expect(dead).toEqual([]);
  });
});
