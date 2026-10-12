// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The development-only `?simulate=` switch (decision 10): `<widget>-down` fails that widget with 502, `<widget>-slow` keeps it
// loading for a few seconds, `<widget>-empty` answers with its empty state. Several values are comma separated. Pure and client
// safe; it is honoured only when NODE_ENV is not production.
export const WIDGETS = ['orders', 'kpis', 'returns', 'stock', 'renewals', 'heads-up', 'store-performance'] as const;
export type Widget = (typeof WIDGETS)[number];
export type Effect = 'down' | 'slow' | 'empty';

export function parseSimulate(value: string | null | undefined, env: { NODE_ENV?: string } = process.env): string[] {
  if (!value || env.NODE_ENV === 'production') return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => /^[a-z-]+-(down|slow|empty)$/.test(v));
}

export const simulated = (list: string[], widget: Widget, effect: Effect): boolean => list.includes(`${widget}-${effect}`);

/** What the page forwards to its widgets: the raw switch outside production, `undefined` in production or when absent. */
export function forwardSimulate(value: string | string[] | undefined, env: { NODE_ENV?: string } = process.env): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const list = parseSimulate(raw, env);
  return list.length ? list.join(',') : undefined;
}
