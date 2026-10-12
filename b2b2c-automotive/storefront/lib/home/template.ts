// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Placeholders an author can use in block texts: {reseller}, {city}, {pickup}. Plain text out, never HTML.
const TOKEN = /\{(reseller|city|pickup)\}/g;

export function fillTemplate(text: string, values: { reseller: string; city?: string; pickup?: string }): string {
  return text.replace(TOKEN, (_, key: 'reseller' | 'city' | 'pickup') => values[key] ?? '').replace(/\s{2,}/g, ' ').trim();
}
