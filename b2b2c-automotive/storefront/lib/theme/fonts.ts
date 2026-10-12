// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Font allow-list for the theme: exactly the families B loads with next/font (lib/fonts-registry.ts).
// A family outside the registry never reaches CSS; it degrades to the system stack.
import { FONT_REGISTRY } from '@/lib/fonts-registry';
import { SAFE_CSS_VALUE } from './color';

const SYSTEM_STACK = 'system-ui, sans-serif';

function stripEndQuotes(segment: string): string {
  const s = segment.trim();
  const first = s[0];
  if (s.length >= 2 && (first === '"' || first === "'") && s.endsWith(first)) return s.slice(1, -1).trim();
  return s;
}

/** 'Inter, system-ui, sans-serif' -> 'Inter'; '"Public Sans", x' -> 'Public Sans'; unsafe or empty -> null. */
export function firstFamily(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 400) return null;
  const segments = raw.split(',').map(stripEndQuotes);
  for (const segment of segments) {
    if (segment.length === 0 || !SAFE_CSS_VALUE.test(segment)) return null;
  }
  return segments[0];
}

function entryFor(name: string) {
  const wanted = name.toLowerCase();
  return FONT_REGISTRY.find((f) => f.family.toLowerCase() === wanted);
}

export function isAllowedFamily(name: string): boolean {
  return entryFor(name) !== undefined;
}

/** Allowed family: `var(<cssVar>), system-ui, sans-serif`; anything else: `system-ui, sans-serif`. */
export function resolveFontStack(raw: unknown): string {
  const family = firstFamily(raw);
  const entry = family === null ? undefined : entryFor(family);
  return entry ? `var(${entry.cssVar}), ${SYSTEM_STACK}` : SYSTEM_STACK;
}
