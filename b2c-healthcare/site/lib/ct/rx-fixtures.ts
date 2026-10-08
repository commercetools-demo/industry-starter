import 'server-only';
import type { Prescription, PrescriptionSource } from '@/lib/clinical/types';
import type { Supply } from '@/lib/ct/shelf-life';
import { fixtureMedicineBySku } from '@/lib/ct/doctors-fixtures';
import { MEDICATIONS, medSku, STOCK } from '@/scripts/seed/data/medications';
import { PATIENTS } from '@/scripts/seed/data/patients';
import { PRESCRIPTIONS } from '@/scripts/seed/data/prescriptions';

/**
 * Development-only data for `/prescriptions` without commercetools (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts):
 * the seed's patients, prescriptions, stock and medicines. Never loaded in production. Fixture "customer ids" are
 * `fixture-<slug>` (e.g. `fixture-sam-rivera`); `scripts/dev-session.ts` prints a session cookie for one.
 * Nothing is written: consuming or restoring refills is not simulated here.
 */

export const fixtureCustomerId = (slug: string) => `fixture-${slug}`;

export function fixturePatient(customerId: string): { patientRef: string; name: string } | null {
  const p = PATIENTS.find((x) => fixtureCustomerId(x.slug) === customerId);
  return p ? { patientRef: p.patientRef, name: `${p.firstName} ${p.lastName}` } : null;
}

const all = (): Prescription[] => structuredClone(PRESCRIPTIONS);

export const fixturePrescriptionSource: PrescriptionSource = {
  async listForPatient(patientRef) {
    return all().filter((r) => r.patientRef === patientRef).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  },
  async getByNumber(number) {
    return all().find((r) => r.number === number) ?? null;
  },
};

export function fixtureSupply(skus: string[]): Map<string, Supply> {
  const out = new Map<string, Supply>();
  for (const d of MEDICATIONS) {
    const sku = medSku(d);
    if (skus.includes(sku)) out.set(sku, { sku, available: STOCK, ...(d.expiryDate ? { expiryDate: d.expiryDate } : {}) });
  }
  return out;
}

/** In-memory stand-in for `lib/ct/ratelimit.ts` (same numbers: 5 failed lookups per 10 minutes per customer). */
const failures = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

function limitStatus(list: number[], now: number) {
  const limited = list.length >= MAX_FAILURES;
  return { limited, remaining: Math.max(0, MAX_FAILURES - list.length), retryAfterSeconds: limited ? Math.ceil((Math.min(...list) + WINDOW_MS - now) / 1000) : 0 };
}

export const fixtureRateLimit = {
  async status(customerId: string) {
    const now = Date.now();
    return limitStatus((failures.get(customerId) ?? []).filter((t) => now - t < WINDOW_MS), now);
  },
  async recordFailure(customerId: string) {
    const now = Date.now();
    const list = [...(failures.get(customerId) ?? []).filter((t) => now - t < WINDOW_MS), now];
    failures.set(customerId, list);
    return limitStatus(list, now);
  },
};

export { fixtureMedicineBySku };
