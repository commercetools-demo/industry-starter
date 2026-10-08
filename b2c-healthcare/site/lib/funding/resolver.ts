import { DEMO_SKU_CLASS } from '@/lib/funding/demo-classes';

/**
 * Payer cost-share (workstream U, Q-060..Q-062 defaults): which part of a medicine the patient's funding scheme
 * covers and what the patient owes. This is a MOCK behind an interface: `FundingResolver` is what a real payer
 * integration would implement; nothing else in the storefront knows the demo rules.
 *
 * Amounts are integer cents PER UNIT (one platform line unit = one pack), so the external line price can be set
 * from `owed` directly. A failed resolution throws `FundingUnavailableError`: callers must show "cover unresolved"
 * and block checkout, never fall back to the list price.
 */

export const DEMO_SCHEME = 'demo-health-plan';

/** `Demo Health Plan` (as seeded on the customer) and `demo-health-plan` are the same scheme. */
export const normalizeScheme = (value: string | null | undefined): string | null => {
  const v = value?.trim().toLowerCase().replace(/\s+/g, '-') ?? '';
  return v === DEMO_SCHEME ? DEMO_SCHEME : null;
};

/** Percent of the pack price the demo plan covers, by medication class. Unlisted classes (OTC, controlled) are not covered. */
export const COVER_PERCENT: Readonly<Record<string, number>> = {
  cardiovascular: 80,
  antibiotics: 50,
  diabetes: 100,
};

export type CoverStatus = 'covered' | 'partly' | 'not-covered';

export interface FundingPatient {
  patientRef: string;
  /** The customer's `fundingScheme` field; absent or unknown means no scheme. */
  fundingScheme?: string | null;
}

export interface FundingLineInput {
  sku: string;
  /** List price per unit, cents. */
  unit: number;
  quantity: number;
}

export interface ResolvedLine {
  sku: string;
  /** Per unit, cents. */
  covered: number;
  /** Per unit, cents: what the patient owes. `covered + owed` is the list price. */
  owed: number;
  status: CoverStatus;
}

export interface Resolution {
  /** The scheme that answered; null when the patient has none (nothing is covered and no cover is shown). */
  scheme: string | null;
  perLine: ResolvedLine[];
  resolvedAt: string;
}

export interface FundingResolver {
  resolve(patient: FundingPatient, lines: FundingLineInput[]): Promise<Resolution>;
}

/** The resolver could not answer. The message is safe to show. */
export class FundingUnavailableError extends Error {
  constructor(message = 'Cover could not be resolved right now.') {
    super(message);
    this.name = 'FundingUnavailableError';
  }
}

export function statusOf(covered: number, owed: number): CoverStatus {
  return owed === 0 ? 'covered' : covered === 0 ? 'not-covered' : 'partly';
}

export interface DemoResolverOptions {
  now?: () => Date;
  /** Every call fails (the `RESOLVER_FORCE_FAIL=1` development switch). */
  forceFail?: boolean;
}

export function createDemoResolver(options: DemoResolverOptions = {}): FundingResolver {
  const now = options.now ?? (() => new Date());
  return {
    async resolve(patient, lines) {
      if (options.forceFail) throw new FundingUnavailableError();
      const scheme = normalizeScheme(patient.fundingScheme);
      const perLine = lines.map((line): ResolvedLine => {
        const percent = scheme ? (COVER_PERCENT[DEMO_SKU_CLASS[line.sku] ?? ''] ?? 0) : 0;
        const covered = Math.round((line.unit * percent) / 100);
        return { sku: line.sku, covered, owed: line.unit - covered, status: statusOf(covered, line.unit - covered) };
      });
      return { scheme, perLine, resolvedAt: now().toISOString() };
    },
  };
}

/** `RESOLVER_FORCE_FAIL=1` is a development switch: it is ignored in production. */
export const resolverForcedToFail = (env: Record<string, string | undefined> = process.env): boolean => env.RESOLVER_FORCE_FAIL === '1' && env.NODE_ENV !== 'production';

/** The resolver for this process (the demo one; a real payer client would be chosen here). */
export function getFundingResolver(env: Record<string, string | undefined> = process.env): FundingResolver {
  return createDemoResolver({ forceFail: resolverForcedToFail(env) });
}
