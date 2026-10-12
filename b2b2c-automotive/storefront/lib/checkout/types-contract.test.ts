// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The `malva-checkout` type belongs to the seed (O D10); checkout only WRITES these fields, on the cart (copied to the order) or the order.
const WRITTEN = ['fitVehicleLabel', 'isTest', 'salesChannel', 'pickupBranchKey'];
const root = path.resolve(import.meta.dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), 'utf8');

describe('malva-checkout contract', () => {
  it('custom field names used by checkout exist in the seed contract', () => {
    const seed = path.resolve(root, '..', 'seed', 'src', 'data', 'custom-types.ts');
    if (!existsSync(seed)) return; // the storefront can be checked on its own
    const text = readFileSync(seed, 'utf8');
    for (const name of WRITTEN) expect(text, name).toContain(`'${name}'`);
  });
  it('checkout never writes mobile', () => {
    for (const file of [['lib', 'ct', 'checkout-prepare.ts'], ['lib', 'ct', 'orders.ts'], ['lib', 'checkout', 'return.ts']]) {
      expect(read(...file), file.join('/')).not.toMatch(/['"]mobile['"]|\bmobile:/);
    }
  });
  it('the fields written come from the constant list', () => {
    const text = read('lib', 'ct', 'checkout-prepare.ts') + read('lib', 'ct', 'orders.ts');
    for (const name of ['fitVehicleLabel', 'isTest', 'salesChannel']) expect(text, name).toContain(name);
  });
});
