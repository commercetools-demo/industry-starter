// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bundleLineStock, bundleUnits, childQuantity, parseBundleContents } from './contents';

const product = (attributes: { name: string; value: unknown }[]) => ({ masterVariant: { attributes } });
const bundle = (skus: string[], quantities: string[]) =>
  product([
    { name: 'component-skus', value: skus },
    { name: 'component-quantities', value: quantities },
  ]);

describe('parseBundleContents (W-11)', () => {
  it('reads the components and their quantities from the two attributes', () => {
    expect(parseBundleContents(bundle(['SK-1', 'SK-2'], ['SK-1:2', 'SK-2:1']))).toEqual([
      { sku: 'SK-1', qty: 2 },
      { sku: 'SK-2', qty: 1 },
    ]);
  });
  it('a part without the attributes is not a bundle', () => {
    expect(parseBundleContents(product([{ name: 'part-number', value: 'X' }]))).toBeNull();
    expect(parseBundleContents({})).toBeNull();
    expect(parseBundleContents({ masterVariant: {} })).toBeNull();
    expect(parseBundleContents(product([{ name: 'component-skus', value: [] }]))).toBeNull();
  });
  it('a component without a quantity entry counts once; entries for unknown skus are ignored', () => {
    expect(parseBundleContents(bundle(['SK-1', 'SK-2'], ['SK-1:3', 'SK-9:5']))).toEqual([
      { sku: 'SK-1', qty: 3 },
      { sku: 'SK-2', qty: 1 },
    ]);
  });
  it('bad quantities fall back to one and absurd ones are capped at 99', () => {
    expect(parseBundleContents(bundle(['A-1', 'B-1', 'C-1'], ['A-1:0', 'B-1:abc', 'C-1:500']))).toEqual([
      { sku: 'A-1', qty: 1 },
      { sku: 'B-1', qty: 1 },
      { sku: 'C-1', qty: 99 },
    ]);
  });
  it('malformed skus and duplicates are dropped', () => {
    expect(parseBundleContents(bundle(['SK-1', 'bad sku!', 'SK-1', 42 as unknown as string], ['SK-1:2']))).toEqual([{ sku: 'SK-1', qty: 2 }]);
  });
  it('a sku that contains a colon cannot spoof a quantity', () => {
    expect(parseBundleContents(bundle(['SK-1'], ['SK-1:2:9']))).toEqual([{ sku: 'SK-1', qty: 1 }]);
  });
  it('finds the attributes on the master variant of the master projection', () => {
    const p = { masterVariant: { attributes: [{ name: 'component-skus', value: ['SK-1'] }] }, variants: [] };
    expect(parseBundleContents(p)).toEqual([{ sku: 'SK-1', qty: 1 }]);
  });
});

describe('bundleUnits: how many bundles can be sold', () => {
  const parts = [
    { sku: 'SK-1', qty: 2 },
    { sku: 'SK-2', qty: 1 },
  ];
  it('is the minimum over the components of available divided by quantity, rounded down', () => {
    expect(bundleUnits(parts, { 'SK-1': 5, 'SK-2': 9 })).toBe(2);
    expect(bundleUnits(parts, { 'SK-1': 8, 'SK-2': 3 })).toBe(3);
  });
  it('is 0 when a component has no stock, no record or is not in the store', () => {
    expect(bundleUnits(parts, { 'SK-1': 5, 'SK-2': 0 })).toBe(0);
    expect(bundleUnits(parts, { 'SK-1': 5 })).toBe(0);
    expect(bundleUnits(parts, { 'SK-1': 1, 'SK-2': 4 })).toBe(0);
  });
  it('no components is 0', () => {
    expect(bundleUnits([], {})).toBe(0);
  });
});

describe('childQuantity', () => {
  it('is the bundle quantity times the component quantity', () => {
    expect(childQuantity(3, 2)).toBe(6);
  });
});

describe('bundleLineStock: a bundle line has no inventory entry, its components decide', () => {
  const parts = [
    { sku: 'SK-1', qty: 2 },
    { sku: 'SK-2', qty: 1 },
  ];
  it('whole bundles from the branch, then the rest from the warehouse', () => {
    expect(bundleLineStock(parts, { 'SK-1': { branchQty: 5, masterQty: 20 }, 'SK-2': { branchQty: 9, masterQty: 9 } })).toEqual({ branchQty: 2, masterQty: 10 }); // 12 whole bundles in all, 2 of them from the branch
  });
  it('a missing or empty component means none', () => {
    expect(bundleLineStock(parts, { 'SK-1': { branchQty: 5, masterQty: 5 } })).toEqual({ branchQty: 0, masterQty: 0 });
    expect(bundleLineStock([], {})).toEqual({ branchQty: 0, masterQty: 0 });
  });
});
