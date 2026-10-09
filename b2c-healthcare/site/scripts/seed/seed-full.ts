import { loadProductImages } from './data/images';
import { runDeletion } from './deletion';
import { runReset } from './reset';
import { runSeed } from './seed';
import { applyStoredImages, missingStoredImages } from './update-images';
import { formatChecks, runVerify } from './verify';
import { DEFAULT_EXPECTED, waitForSearch } from './wait-for-search';
import { getAdminRoot, isMain, makeCtx, parseFlags, PROJECT_KEY, readSeedEnv, realSleep, type Ctx, type Flags, type Root } from './lib';

/**
 * A full seeding on a clean slate (D-038), every stage in one process with the same client and project-key guard:
 *
 *   1. reset           reviews, mlv- resources, every malva-* Custom Object, recurrence policies and (--include-customers, always on here)
 *                      the example.com customers with their carts, orders, payments, lists and recurring orders
 *   2. cleanup-sample  the sample (furniture) data, behind --confirm
 *   3. seed            everything, with the photos from data/product-images.json
 *   4. images          checks every doctor, medication and banner slot has a stored photo and aligns the products with it
 *   5. verify          read-back assertions
 *   6. wait-for-search waits until the Product Search index holds the seeded products
 *
 *   npm run seed:full -- --dry-run          (lists what would happen; writes nothing; verify and the search wait are skipped)
 *   npm run seed:full                       (the script passes --confirm spec-test-b2c-healthcare)
 *
 * Needs `.env.seed.local` (OA-01). Without credentials nothing runs: the project key is checked before any network call.
 */
export interface FullOptions { dryRun: boolean; patientPassword?: string; sleep?: (ms: number) => Promise<void> }
export interface FullResult { ok: boolean; stages: { name: string; ok: boolean; detail: string }[] }

export function checkFullConfirm(flags: Flags): void {
  if (!flags.dryRun && flags.confirm !== PROJECT_KEY) throw new Error(`seed:full deletes seeded data and the sample data. Add --confirm ${PROJECT_KEY} (or --dry-run to list).`);
}

export async function runFull(root: Root, o: FullOptions, log: (line: string) => void = console.log): Promise<FullResult> {
  const ctx: Ctx = { ...makeCtx(root, { dryRun: o.dryRun }, log), ...(o.sleep ? { sleep: o.sleep, pauseMs: 0 } : {}) };
  const stages: FullResult['stages'] = [];
  const stage = async (name: string, run: () => Promise<{ ok?: boolean; detail: string }>) => {
    log(`\n== ${name}${o.dryRun ? ' (dry run)' : ''}`);
    const r = await run();
    stages.push({ name, ok: r.ok ?? true, detail: r.detail });
    return r.ok ?? true;
  };

  const steps: [string, () => Promise<{ ok?: boolean; detail: string }>][] = [
    ['reset (--include-customers)', async () => {
      const r = await runReset(ctx, { includeCustomers: true });
      return { detail: `${r.customers} customer(s), ${r.resources} resource(s), ${r.objects} custom object(s)` };
    }],
    ['cleanup-sample', async () => {
      const r = await runDeletion(ctx, 'sample');
      return { detail: `${r.planned} sample resource(s)` };
    }],
    ['seed', async () => {
      const r = await runSeed(ctx, { images: loadProductImages(), clinical: true, patientPassword: o.patientPassword });
      return { ok: r.ok, detail: `${r.changed} change(s)` };
    }],
    ['images', async () => {
      if (o.dryRun) {
        const missing = missingStoredImages();
        return { ok: missing.length === 0, detail: missing.length === 0 ? 'stored photos complete' : `missing ${missing.join(', ')}` };
      }
      const r = await applyStoredImages(root, false, log);
      return { detail: `${r.applied} product(s) aligned` };
    }],
  ];
  if (!o.dryRun) {
    steps.push(
      ['verify', async () => {
        // rating statistics and the index lag a few seconds behind the writes: look again before calling it a failure
        let checks = await runVerify(root, { search: false, clinical: true });
        for (let attempt = 1; attempt <= 5 && checks.some((c) => !c.ok); attempt += 1) {
          log(`verify: ${checks.filter((c) => !c.ok).length} check(s) failing, waiting 5 s (attempt ${attempt} of 5)`);
          await (o.sleep ?? realSleep)(5000);
          checks = await runVerify(root, { search: false, clinical: true });
        }
        log(formatChecks(checks));
        const failed = checks.filter((c) => !c.ok).length;
        return { ok: failed === 0, detail: failed === 0 ? `${checks.length} checks passed` : `${failed} of ${checks.length} failed` };
      }],
      ['wait-for-search', async () => {
        const total = await waitForSearch(root, { expected: DEFAULT_EXPECTED, log, ...(o.sleep ? { sleep: o.sleep } : {}) });
        return { detail: `index holds ${total} product(s)` };
      }],
    );
  } else {
    log('\n(verify and wait-for-search are skipped in a dry run: nothing was written)');
  }

  for (const [name, run] of steps) {
    if (!(await stage(name, run))) {
      log(`\nstopped at "${name}": ${stages.at(-1)?.detail}`);
      return { ok: false, stages };
    }
  }
  log(`\n${o.dryRun ? 'dry run: ' : ''}seed:full ${stages.map((s) => `${s.name}: ${s.detail}`).join('; ')}`);
  return { ok: true, stages };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  checkFullConfirm(flags);
  const { root } = await getAdminRoot();
  const patientPassword = readSeedEnv().SEED_PATIENT_PASSWORD ?? process.env.SEED_PATIENT_PASSWORD;
  if (!patientPassword) console.log('SEED_PATIENT_PASSWORD is not set: the three demo patients will not be created.');
  const result = await runFull(root, { dryRun: flags.dryRun, patientPassword });
  if (!result.ok) process.exit(1);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
