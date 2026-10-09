import { reloadAllowances, type AllowanceStore, type ReloadResult } from '../lib/funding/allowance-core';
import { customObjectsStore, type CustomObjectsRoot } from '../lib/funding/ct-store';
import { getAdminRoot, isMain, parseFlags, type Root } from './seed/lib';

/**
 * Monthly allowance reload: grants the current cycle to every member once and forfeits what is left of
 * every earlier cycle once (no carry-over). Idempotent per member per cycle: running it twice changes nothing the second
 * time, so a retried or doubled schedule is harmless.
 *
 *   npx tsx scripts/reload-allowances.ts [--dry-run] [--at 2026-11-01]
 *
 * Same client and project guard as the seed scripts (`.env.seed.local`). The production schedule is the Netlify scheduled
 * function `netlify/functions/reload-allowances-scheduled.ts`, which runs the same code.
 */

/** Reads like the real store; writes are counted but not made. */
export function dryRunStore(real: AllowanceStore): AllowanceStore {
  return {
    get: (container, key) => real.get(container, key),
    query: (container, where) => real.query(container, where),
    put: async (container, key, value, version) => ({ key, version: (version ?? 0) + 1, value }),
    createOnly: async (container, key) => (await real.get(container, key)) === null,
  };
}

export interface ReloadRun extends ReloadResult {
  dryRun: boolean;
  cycleAt: string;
}

export async function runReload(root: Root, now: Date, options: { dryRun?: boolean; log?: (line: string) => void } = {}): Promise<ReloadRun> {
  const log = options.log ?? console.log;
  const real = customObjectsStore(root as unknown as CustomObjectsRoot);
  const result = await reloadAllowances(options.dryRun ? dryRunStore(real) : real, now);
  log(`${options.dryRun ? 'dry run: ' : ''}${result.members} member(s), ${result.granted} cycle(s) granted, ${result.lapsedCycles} cycle(s) forfeited (${result.lapsedCents} cents)`);
  return { ...result, dryRun: options.dryRun === true, cycleAt: now.toISOString() };
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv);
  const at = argv.indexOf('--at');
  const now = at >= 0 && argv[at + 1] ? new Date(`${argv[at + 1]}T12:00:00Z`) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('--at needs a date like 2026-11-01');
  const { root } = await getAdminRoot();
  await runReload(root, now, { dryRun: flags.dryRun });
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
