// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Input checks that run before any provider is called. Pure, safe in client code.
export type PlateReason = 'plate-format';
export type VinReason = 'vin-length' | 'vin-characters';
export type Validated<R extends string> = { ok: true; value: string } | { ok: false; reason: R };

/** Trimmed, upper-cased, 2 to 10 characters from `[A-Z0-9 -]` with at least one letter or digit. */
export function validatePlate(input: string): Validated<PlateReason> {
  const value = input.trim().toUpperCase();
  if (value.length < 2 || value.length > 10 || !/^[A-Z0-9 -]+$/.test(value) || !/[A-Z0-9]/.test(value)) return { ok: false, reason: 'plate-format' };
  return { ok: true, value };
}

/** Upper-cased, exactly 17 characters, no I, O or Q and nothing but letters and digits. No check digit (only North American VINs carry one). */
export function validateVin(input: string): Validated<VinReason> {
  const value = input.trim().toUpperCase();
  if (value.length !== 17) return { ok: false, reason: 'vin-length' };
  if (!/^[A-HJ-NPR-Z0-9]+$/.test(value)) return { ok: false, reason: 'vin-characters' };
  return { ok: true, value };
}
