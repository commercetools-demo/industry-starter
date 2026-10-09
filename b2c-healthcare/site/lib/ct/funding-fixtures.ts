import 'server-only';
import { fixtureCustomerId } from '@/lib/ct/rx-fixtures';
import type { StoredObject } from '@/lib/ct/custom-objects';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { Credential, CredentialSource } from '@/lib/clinical/types';
import { allowanceCycle, ALLOWANCE_MEMBERS, allowanceObjectKey, cycleFor } from '@/scripts/seed/data/allowances';
import { CREDENTIALS } from '@/scripts/seed/data/credentials';
import { PATIENTS } from '@/scripts/seed/data/patients';
import { getAllowanceView, type AllowanceStore } from '@/lib/ct/allowance';
import { buildTenderView, planTender } from '@/lib/funding/tender';
import { splitBasket } from '@/lib/funding/eligibility';
import type { Cart, TenderView } from '@/lib/types';

/**
 * Development-only funding data (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): an in-memory Custom Object store with
 * the same version rules (create-only, conflict on a stale version) holding Sam's allowance for the current cycle,
 * and the seed's credentials (Sam active, Jordan pending, Alex none). On `globalThis` because route handlers and
 * pages are separate bundles in `next dev`. Never loaded in production.
 */

type Row = { version: number; value: unknown };
const shared = globalThis as unknown as { __malvaFundingStore?: Map<string, Row> };
const rows = (shared.__malvaFundingStore ??= new Map<string, Row>());
const id = (container: string, key: string) => `${container}/${key}`;
const conflict = () => Object.assign(new Error('version conflict'), { statusCode: 409 });

function seedOnce(): void {
  const cycle = cycleFor(new Date());
  for (const m of ALLOWANCE_MEMBERS) {
    const k = id(CONTAINERS.allowance, allowanceObjectKey(m.patientRef, cycle));
    if (!rows.has(k)) rows.set(k, { version: 1, value: allowanceCycle(m.patientRef, m.monthly, cycle) });
  }
}
seedOnce();

export const fixtureStore: AllowanceStore = {
  async get<T>(container: string, key: string) {
    const row = rows.get(id(container, key));
    return row ? ({ key, version: row.version, value: structuredClone(row.value) as T } satisfies StoredObject<T>) : null;
  },
  async put<T>(container: string, key: string, value: T, version?: number) {
    const existing = rows.get(id(container, key));
    if (version !== undefined && (existing?.version ?? 0) !== version) throw conflict();
    const next: Row = { version: (existing?.version ?? 0) + 1, value: structuredClone(value) };
    rows.set(id(container, key), next);
    return { key, version: next.version, value: structuredClone(value) };
  },
  async createOnly<T>(container: string, key: string, value: T) {
    if (rows.has(id(container, key))) return false;
    rows.set(id(container, key), { version: 1, value: structuredClone(value) });
    return true;
  },
  async query<T>(container: string) {
    return [...rows.entries()]
      .filter(([k]) => k.startsWith(`${container}/`))
      .map(([k, row]) => ({ key: k.slice(container.length + 1), version: row.version, value: structuredClone(row.value) as T }));
  },
};

const choice = ((globalThis as unknown as { __malvaFixtureRestricted?: Set<string> }).__malvaFixtureRestricted ??= new Set<string>());

/** Whether this fixture customer chose the restricted instrument (the fixture stand-in for a restricted Payment on the cart). */
export const fixtureRestrictedChoice = (customerId: string): boolean => choice.has(customerId);
export function setFixtureRestrictedChoice(customerId: string, on: boolean): void {
  if (on) choice.add(customerId);
  else choice.delete(customerId);
}

/** The patient ref behind a fixture customer id (`fixture-<slug>`). */
export const fixturePatientRef = (customerId: string): string | null => PATIENTS.find((p) => fixtureCustomerId(p.slug) === customerId)?.patientRef ?? null;

/** The seed's credentials (a pending one for Jordan is added by the seed in U-13). */
export const fixtureCredentialSource: CredentialSource = {
  async listForPatient(patientRef) {
    return structuredClone(CREDENTIALS.filter((c) => c.patientRef === patientRef)) as Credential[];
  },
  async get(patientRef, credentialClass) {
    return structuredClone(CREDENTIALS.find((c) => c.patientRef === patientRef && c.class === credentialClass) ?? null) as Credential | null;
  },
};

/** QA only: forget every fixture draw (tests of the fixtures). */
export function resetFundingFixtures(): void {
  for (const k of [...rows.keys()]) rows.delete(k);
  seedOnce();
}

/**
 * The tender view for the in-memory cart (same arithmetic as production: `buildTenderView` over the cart's lines and
 * the payable total, the allowance balance from the fixture store). `total` is what the patient owes including delivery.
 */
export async function fixtureTenderView(cart: Pick<Cart, 'lines' | 'total'>, customerId: string, patientRef: string, now: Date = new Date()): Promise<TenderView> {
  const allowance = await getAllowanceView(patientRef, now);
  const lines = cart.lines.map((l) => ({ id: l.id, eligible: l.eligibleForRestricted === true, amount: l.totalPrice.centAmount }));
  return buildTenderView({ currencyCode: cart.total.currencyCode, fractionDigits: cart.total.fractionDigits, total: cart.total.centAmount, allowance, lines, restrictedChosen: fixtureRestrictedChoice(customerId) });
}

/** The plan the fixture placement uses (allowance balance now, eligible subtotal, the patient's choice). */
export async function fixturePlan(cart: Pick<Cart, 'lines' | 'total'>, customerId: string, patientRef: string, now: Date = new Date()) {
  const allowance = await getAllowanceView(patientRef, now);
  const eligible = splitBasket(cart.lines.map((l) => ({ id: l.id, eligible: l.eligibleForRestricted === true, amount: l.totalPrice.centAmount }))).eligibleSubtotal;
  return planTender({ total: cart.total.centAmount, allowanceBalance: allowance?.balance ?? 0, eligibleSubtotal: eligible, restrictedChosen: fixtureRestrictedChoice(customerId) && eligible > 0 });
}
