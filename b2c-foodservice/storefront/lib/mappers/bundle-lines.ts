// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/**
 * The only place that reads the preset-bundle line fields (workstream V, D3). Every other file uses these helpers.
 * A parent line has a line-item key starting with `bundle-`; a child line has the custom field `parentId` = that key.
 */

/** The part of a commercetools line item these helpers read. */
export interface BundleAwareLine {
  id: string;
  key?: string | null;
  custom?: { fields?: Record<string, unknown> } | null;
}

export const BUNDLE_KEY_PREFIX = 'bundle-';

const field = (line: BundleAwareLine, name: string): unknown => line.custom?.fields?.[name];

/** The parent line's `parentId` value (a child's custom field), or undefined. */
function parentIdOf(line: BundleAwareLine): string | undefined {
  const value = field(line, 'parentId');
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function isBundleParent(line: BundleAwareLine): boolean {
  return typeof line.key === 'string' && line.key.startsWith(BUNDLE_KEY_PREFIX);
}

export function isBundleChild(line: BundleAwareLine): boolean {
  return parentIdOf(line) !== undefined;
}

export function isBundleLine(line: BundleAwareLine): boolean {
  return isBundleParent(line) || isBundleChild(line);
}

/** The children of one parent: the lines whose `parentId` is the parent's key. A line without a parent key has none. */
export function childrenOf<T extends BundleAwareLine>(lines: readonly T[], parent: BundleAwareLine): T[] {
  if (!isBundleParent(parent)) return [];
  return lines.filter((line) => isBundleChild(line) && parentIdOf(line) === parent.key);
}

/** The preset's position in `presets[]` (stored as text "0", "1"). Null for anything that is not a whole number. */
export function bundlePresetOf(line: BundleAwareLine): number | null {
  const value = field(line, 'bundlePreset');
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  return Number(value);
}
