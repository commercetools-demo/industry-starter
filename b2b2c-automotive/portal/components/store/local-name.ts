// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The display text of a localized name: the viewer's locale, then the other language, then the fallback. Pure.
export function localName(name: Record<string, string> | undefined, locale: string, fallback: string): string {
  if (!name) return fallback;
  return name[locale] || name['en-US'] || name['de-DE'] || Object.values(name)[0] || fallback;
}
