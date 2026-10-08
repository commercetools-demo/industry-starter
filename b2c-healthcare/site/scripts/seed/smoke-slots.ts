import { candidateSlots, slotClaimKey, type Mode, type Schedule } from '../../lib/clinical/slots';
import { getAdminRoot, isMain, type Root } from './lib';

/**
 * Live smoke test of scheduling (needs the seeded project): prints the free slots of a doctor and claims the first one
 * twice with `version: 0`; the second claim must fail with 409 (double-booking protection). The test claim is deleted again.
 *
 *   npx tsx scripts/seed/smoke-slots.ts [doctor-key] [remote|office]
 *
 * Uses the seed admin client (SEED_CTP_*), not the storefront client. Prints no secrets.
 */
const status = (e: unknown) => (e as { statusCode?: number }).statusCode;

export interface SmokeResult { free: number; first?: string; secondClaimRejected: boolean }

export async function smokeSlots(root: Root, doctorKey = 'mlv-doc-amara-okafor', mode: Mode = 'office', now = new Date(), log: (l: string) => void = console.log): Promise<SmokeResult> {
  const co = root.customObjects();
  let schedule: Schedule;
  try {
    schedule = (await co.withContainerAndKey({ container: 'malva-schedule', key: doctorKey }).get().execute()).body.value as Schedule;
  } catch (e) {
    if (status(e) === 404) throw new Error(`No schedule for ${doctorKey}: run npm run seed first.`);
    throw e;
  }
  const claims = (await co.withContainer({ container: 'malva-slot-claim' }).get({ queryArgs: { where: `value(doctorKey="${doctorKey}" and mode="${mode}")`, limit: 200 } }).execute()).body.results;
  const taken = new Set(claims.map((c) => new Date((c.value as { startsAt: string }).startsAt).toISOString()));
  const free = candidateSlots(schedule, now).filter((s) => !taken.has(s.startsAt));
  log(`${doctorKey} (${mode}, ${schedule.timezone}): ${free.length} free slot(s) in the next 7 days`);
  for (const s of free.slice(0, 8)) log(`  ${s.localDate} ${s.localTime} (${s.startsAt})`);
  if (free.length === 0) return { free: 0, secondClaimRejected: false };

  const first = free[free.length - 1]; // the last slot: leaves the early ones for real use
  const key = slotClaimKey(doctorKey, mode, first.startsAt);
  const body = { container: 'malva-slot-claim', key, value: { doctorKey, mode, startsAt: first.startsAt, claimedAt: now.toISOString(), requestId: 'smoke-test' }, version: 0 };
  await co.post({ body }).execute();
  log(`claimed ${first.startsAt}`);
  let rejected = false;
  try {
    await co.post({ body }).execute();
    log('FAIL  the second claim succeeded');
  } catch (e) {
    rejected = status(e) === 409;
    log(rejected ? 'PASS  the second claim of the same slot failed with 409' : `FAIL  the second claim failed with ${String(status(e))}`);
  } finally {
    await co.withContainerAndKey({ container: 'malva-slot-claim', key }).delete({}).execute();
    log('released the test claim');
  }
  return { free: free.length, first: first.startsAt, secondClaimRejected: rejected };
}

async function main() {
  const [doctorKey, mode] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const { root } = await getAdminRoot();
  const r = await smokeSlots(root, doctorKey, mode as Mode | undefined);
  if (r.free > 0 && !r.secondClaimRejected) process.exit(1);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
