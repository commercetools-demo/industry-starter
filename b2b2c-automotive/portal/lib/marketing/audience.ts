/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Audience rules of the e-mail campaigns (W-07, D3). Pure and deterministic: no LLM. Consent is ALWAYS applied by
// `selectRecipients`; a rule can never select a customer who has not consented. Nothing is ever sent (Q-P01).
export type Cond =
  | { type: 'bought-category'; categoryKey: string }
  | { type: 'not-bought-category'; categoryKey: string }
  | { type: 'bought-sku'; sku: string }
  | { type: 'no-order-since'; days: number }
  | { type: 'registered' };

export interface Rule {
  all: Cond[];
}

/** What is known about one customer of the store. JSON-serializable (cached). */
export interface CustomerFact {
  customerId: string;
  /** `marketingConsent === true` on the customer's custom fields; a customer without the field has not consented. */
  consent: boolean;
  /** Category keys of every bought part, ancestors included. */
  categoryKeys: string[];
  skus: string[];
  lastOrderAt: string | null;
}

const DAY_MS = 86_400_000;

export function evaluate(rule: Rule, fact: CustomerFact, now: number = Date.now()): boolean {
  return rule.all.every((cond) => {
    switch (cond.type) {
      case 'bought-category':
        return fact.categoryKeys.includes(cond.categoryKey);
      case 'not-bought-category':
        return !fact.categoryKeys.includes(cond.categoryKey);
      case 'bought-sku':
        return fact.skus.includes(cond.sku);
      case 'no-order-since':
        return fact.lastOrderAt === null || now - Date.parse(fact.lastOrderAt) > cond.days * DAY_MS;
      case 'registered':
        return true;
    }
  });
}

/** The customers a campaign with this rule would reach: the rule AND consent. */
export function selectRecipients(rule: Rule, facts: readonly CustomerFact[], now: number = Date.now()): CustomerFact[] {
  return facts.filter((fact) => fact.consent === true && evaluate(rule, fact, now));
}

/** The rule in words, with category keys replaced by `names[key]`. */
export function describe(rule: Rule, names: Readonly<Record<string, string>>): string {
  const part = (cond: Cond): string => {
    switch (cond.type) {
      case 'bought-category':
        return `bought ${names[cond.categoryKey] ?? cond.categoryKey}`;
      case 'not-bought-category':
        return `did not buy ${names[cond.categoryKey] ?? cond.categoryKey}`;
      case 'bought-sku':
        return `bought ${cond.sku}`;
      case 'no-order-since':
        return `no order in ${cond.days} days`;
      case 'registered':
        return 'registered';
    }
  };
  return rule.all.length ? rule.all.map(part).join(' and ') : 'registered';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Strict parse of a rule from untrusted JSON (a stored object or a request body); null when malformed. */
export function parseRule(raw: unknown): Rule | null {
  if (!isRecord(raw) || !Array.isArray(raw.all) || raw.all.length > 8) return null;
  const all: Cond[] = [];
  for (const item of raw.all) {
    if (!isRecord(item)) return null;
    switch (item.type) {
      case 'bought-category':
      case 'not-bought-category':
        if (typeof item.categoryKey !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(item.categoryKey)) return null;
        all.push({ type: item.type, categoryKey: item.categoryKey });
        break;
      case 'bought-sku':
        if (typeof item.sku !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(item.sku)) return null;
        all.push({ type: 'bought-sku', sku: item.sku });
        break;
      case 'no-order-since':
        if (typeof item.days !== 'number' || !Number.isInteger(item.days) || item.days < 1 || item.days > 3650) return null;
        all.push({ type: 'no-order-since', days: item.days });
        break;
      case 'registered':
        all.push({ type: 'registered' });
        break;
      default:
        return null;
    }
  }
  return { all };
}
