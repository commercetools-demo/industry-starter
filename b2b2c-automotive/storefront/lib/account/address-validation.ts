// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Address checks of the account area (workstream Q-09), pure. Shapes only: commercetools does not validate postal codes.

export const MAX_ADDRESSES = 20;

const POSTAL: Record<string, RegExp> = {
  DE: /^\d{5}$/,
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  AT: /^\d{4}$/,
  CH: /^\d{4}$/,
  NL: /^\d{4} ?[A-Za-z]{2}$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
};
const FALLBACK = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;

export const isValidPostalCode = (country: string, postalCode: string): boolean => (POSTAL[country.toUpperCase()] ?? FALLBACK).test(postalCode.trim());

/** `countries` empty means the store lists none: any two-letter code is accepted. */
export const isCountryAllowed = (country: string, countries: readonly string[]): boolean => /^[A-Z]{2}$/.test(country) && (countries.length === 0 || countries.includes(country));
