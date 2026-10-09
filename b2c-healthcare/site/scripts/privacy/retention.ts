import { RETENTION } from './inventory';
import { getAdminRoot, getObject, isMain, objectsOf, parseFlags, queryObjects, type Rec, type Root } from './lib';
import { realSleep, withRetry } from '../seed/lib';
import { slotClaimKey } from '../../lib/clinical/slots';

/**
 * Retention (workstream X, spec: "Retention expires with the basis"): removes or de-identifies what outlived its basis.
 *
 *  - guest bookings past `expiresAt` (visit + 90 days) are deleted, with their slot claim;
 *  - cancelled patient bookings more than 90 days after the visit are de-identified (the reason text and the phone are removed,
 *    the booking itself stays as a history row);
 *  - slot claims for slots that are more than a day in the past;
 *  - rate-limit objects with no failure inside the 10 minute window;
 *  - checkout attempt locks older than 30 days;
 *  - auto-refill log entries older than 180 days.
 *
 *   npx tsx scripts/privacy/retention.ts [--dry-run]
 *
 * Every delete is `dataErasure=true`. Idempotent. Counts only in the log (never a key, reference or value). Also runs as the
 * scheduled Netlify function `netlify/functions/retention.ts` (same code, guarded by `RETENTION_SECRET`).
 */
export interface RetentionOptions {
  dryRun?: boolean;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface RetentionResult {
  dryRun: boolean;
  guestBookingsDeleted: number;
  cancelledBookingsDeidentified: number;
  slotClaimsDeleted: number;
  rateLimitsDeleted: number;
  orderAttemptsDeleted: number;
  refillLogsDeleted: number;
}

const DAY = 24 * 60 * 60 * 1000;
const REMOVED = '[removed]';

interface BookingValue { reference?: string; doctorKey?: string; mode?: 'remote' | 'office'; startsAt?: string; status?: string; guest?: unknown; expiresAt?: string; reason?: string; phone?: string }

const ms = (iso: unknown): number => (typeof iso === 'string' ? Date.parse(iso) : Number.NaN);

export async function runRetention(root: Root, now: Date = new Date(), o: RetentionOptions = {}): Promise<RetentionResult> {
  const log = o.log ?? console.log;
  const sleep = o.sleep ?? realSleep;
  const dryRun = o.dryRun === true;
  const t = now.getTime();
  const result: RetentionResult = { dryRun, guestBookingsDeleted: 0, cancelledBookingsDeidentified: 0, slotClaimsDeleted: 0, rateLimitsDeleted: 0, orderAttemptsDeleted: 0, refillLogsDeleted: 0 };

  const remove = async (container: string, obj: Rec): Promise<void> => {
    if (dryRun) return;
    await withRetry(() => objectsOf(root).withContainerAndKey({ container, key: obj.key as string }).delete({ queryArgs: { version: obj.version, dataErasure: true } }).execute(), sleep);
    await sleep(50);
  };

  // ---- guest bookings past expiresAt (and their claim)
  const bookings = await queryObjects(root, 'malva-booking');
  const deletedClaims = new Set<string>();
  const dropClaim = async (v: BookingValue): Promise<void> => {
    if (!v.doctorKey || !v.mode || !v.startsAt) return;
    const key = slotClaimKey(v.doctorKey, v.mode, v.startsAt);
    const claim = await getObject(root, 'malva-slot-claim', key);
    if (!claim) return;
    await remove('malva-slot-claim', claim);
    deletedClaims.add(key);
    result.slotClaimsDeleted += 1;
  };
  for (const b of bookings) {
    const v = b.value as BookingValue;
    if (v.guest !== undefined && ms(v.expiresAt) <= t) {
      await dropClaim(v);
      await remove('malva-booking', b);
      result.guestBookingsDeleted += 1;
    } else if (v.guest === undefined && v.status === 'cancelled' && ms(v.startsAt) + RETENTION.cancelledBookingDays * DAY <= t && (v.reason !== REMOVED || v.phone !== undefined)) {
      // De-identify: the booking stays, what the person said and how to reach them goes.
      if (!dryRun) {
        const { phone: _phone, ...rest } = v;
        void _phone;
        await withRetry(() => objectsOf(root).post({ body: { container: 'malva-booking', key: b.key, version: b.version, value: { ...rest, reason: REMOVED } } }).execute(), sleep);
        await sleep(50);
      }
      result.cancelledBookingsDeidentified += 1;
    }
  }

  // ---- slot claims for slots long past
  for (const c of await queryObjects(root, 'malva-slot-claim')) {
    if (deletedClaims.has(c.key as string)) continue;
    if (ms((c.value as { startsAt?: string }).startsAt) + RETENTION.slotClaimStaleDays * DAY <= t) {
      await remove('malva-slot-claim', c);
      result.slotClaimsDeleted += 1;
    }
  }

  // ---- rate-limit counters with no failure left in the window
  for (const r of await queryObjects(root, 'malva-ratelimit')) {
    const failures = (r.value as { failures?: unknown }).failures;
    if (!Array.isArray(failures)) continue;
    if (failures.every((f) => typeof f === 'number' && t - f >= RETENTION.rateLimitWindowMs)) {
      await remove('malva-ratelimit', r);
      result.rateLimitsDeleted += 1;
    }
  }

  // ---- checkout attempt locks
  for (const a of await queryObjects(root, 'malva-order-attempt')) {
    if (ms((a.value as { at?: string }).at) + RETENTION.orderAttemptDays * DAY <= t) {
      await remove('malva-order-attempt', a);
      result.orderAttemptsDeleted += 1;
    }
  }

  // ---- stale refill log entries
  for (const l of await queryObjects(root, 'malva-refill-log')) {
    if (ms((l.value as { runAt?: string }).runAt) + RETENTION.refillLogDays * DAY <= t) {
      await remove('malva-refill-log', l);
      result.refillLogsDeleted += 1;
    }
  }

  log(
    `${dryRun ? 'dry run: ' : ''}${result.guestBookingsDeleted} guest booking(s), ${result.cancelledBookingsDeidentified} cancelled booking(s) de-identified, ${result.slotClaimsDeleted} slot claim(s), ` +
      `${result.rateLimitsDeleted} rate limit(s), ${result.orderAttemptsDeleted} attempt lock(s), ${result.refillLogsDeleted} refill log(s)${dryRun ? ' would be handled' : ' handled'}`,
  );
  return result;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const { root } = await getAdminRoot();
  await runRetention(root, new Date(), { dryRun: flags.dryRun });
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
