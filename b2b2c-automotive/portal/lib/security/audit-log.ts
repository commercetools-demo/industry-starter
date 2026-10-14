// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Security decisions as one JSON line on stdout (workstream X, decision D8): `{ ts, rule, decision, route, actor }`.
// Any key named like a token, cookie, password, e-mail or JWT is dropped; no body is ever logged. Pure and dependency free.

export interface SecurityDecision {
  rule: string;
  decision: 'allow' | 'deny';
  route: string;
  /** An opaque id (customer id) or `anonymous`; never an e-mail. */
  actor?: string;
  [extra: string]: unknown;
}

const SENSITIVE_KEY = /token|authorization|cookie|password|email|jwt|secret/i;

/** The entry without sensitive keys; nested values are dropped for simplicity (a decision line is flat). */
export function redactDecision(entry: SecurityDecision, now: () => Date = () => new Date()): Record<string, unknown> {
  const out: Record<string, unknown> = { ts: now().toISOString() };
  for (const [key, value] of Object.entries(entry)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (value !== null && typeof value === 'object') continue;
    out[key] = typeof value === 'string' ? value.slice(0, 200) : value;
  }
  return out;
}

export function logDecision(entry: SecurityDecision): void {
  console.log(JSON.stringify(redactDecision(entry)));
}
