// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import {
  bundlePresetOf, childrenOf, isBundleChild, isBundleLine, isBundleParent, type BundleAwareLine,
} from '@/lib/mappers/bundle-lines';

const parent: BundleAwareLine = { id: 'L1', key: 'bundle-abc', custom: { fields: { bundlePreset: '1' } } };
const machine: BundleAwareLine = { id: 'L2', key: undefined, custom: { fields: { parentId: 'bundle-abc' } } };
const pod: BundleAwareLine = { id: 'L3', custom: { fields: { parentId: 'bundle-abc' } } };
const ownSameSku: BundleAwareLine = { id: 'L4', custom: { fields: { fulfilment: 'collect' } } };
const otherParent: BundleAwareLine = { id: 'L5', key: 'bundle-zzz' };
const orphan: BundleAwareLine = { id: 'L6', custom: { fields: { parentId: 'bundle-gone' } } };

describe('bundle line helpers (D3)', () => {
  it('recognises a parent by its key prefix', () => {
    expect(isBundleParent(parent)).toBe(true);
    expect(isBundleParent(machine)).toBe(false);
    expect(isBundleParent(ownSameSku)).toBe(false);
  });

  it('recognises a child by parentId', () => {
    expect(isBundleChild(machine)).toBe(true);
    expect(isBundleChild(parent)).toBe(false);
    expect(isBundleChild(ownSameSku)).toBe(false);
  });

  it('a normal line is neither parent nor child', () => {
    expect(isBundleLine(ownSameSku)).toBe(false);
    expect(isBundleLine(parent)).toBe(true);
    expect(isBundleLine(pod)).toBe(true);
  });

  it('childrenOf returns only the lines linked to that parent key', () => {
    const lines = [parent, machine, ownSameSku, pod, otherParent, orphan];
    expect(childrenOf(lines, parent).map((l) => l.id)).toEqual(['L2', 'L3']);
    expect(childrenOf(lines, otherParent)).toEqual([]);
    expect(childrenOf(lines, machine)).toEqual([]);
  });

  it('bundlePresetOf reads the position as a whole number, else null', () => {
    expect(bundlePresetOf(parent)).toBe(1);
    expect(bundlePresetOf({ id: 'x', custom: { fields: { bundlePreset: '1.5' } } })).toBeNull();
    expect(bundlePresetOf(machine)).toBeNull();
  });
});
