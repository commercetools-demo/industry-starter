// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { BundleMachineOption, BundlePresetView, BundleView } from '@/lib/types';

/** The most a shopper can add in one line (CART_MAX_LINE_QUANTITY is the same bound on the server). */
export const BUNDLE_MAX_QUANTITY = 99;

/** The preset to open with: `?preset=<index>` when it is valid and available, else the first available one (workstream V, D9). */
export function initialPresetOf(bundle: BundleView, requested: number | null): BundlePresetView | undefined {
  const asked = requested === null ? undefined : bundle.presets.find((p) => p.index === requested && p.available);
  return asked ?? bundle.presets.find((p) => p.available);
}

/** The machine variant to show: the one asked for, else the first that can be bought, else the first. */
export function machineOf(preset: BundlePresetView | undefined, sku?: string): BundleMachineOption | undefined {
  if (!preset) return undefined;
  return preset.machines.find((m) => m.sku === sku)
    ?? preset.machines.find((m) => m.price !== null && m.inStock)
    ?? preset.machines[0];
}

/** Parses `?preset=<n>`: a whole number from 0 to 19, else null. */
export function parsePresetParam(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d{1,2}$/.test(value)) return null;
  const n = Number(value);
  return n <= 19 ? n : null;
}
