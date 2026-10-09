import { runReset } from './reset';
import { getAdminRoot, isMain, makeCtx, parseFlags, PROJECT_KEY, type Flags } from './lib';

/**
 * Deletes ONLY what the seed created, in dependency order, so the project can be rebuilt (D-038): reviews first, then the `mlv-`
 * products, categories, types, states, channels, zones, shipping, tax, recurrence policies, and every `malva-*` Custom Object container.
 * With `--include-customers` also the synthetic customers (emails on example.com) with their carts, orders, payments, shopping lists and
 * recurring orders (DELETE with dataErasure). Sample data and the `usa` and `europe` zones are never touched (cleanup-sample.ts).
 *
 *   npx tsx scripts/seed/reset-seed.ts --dry-run [--include-customers]
 *   npx tsx scripts/seed/reset-seed.ts --confirm spec-test-b2c-healthcare [--include-customers]
 */
export function checkConfirm(flags: Flags): void {
  if (!flags.dryRun && flags.confirm !== PROJECT_KEY) throw new Error(`Add --confirm ${PROJECT_KEY} to delete (or --dry-run to list).`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  checkConfirm(flags);
  const { root } = await getAdminRoot();
  await runReset(makeCtx(root, flags), { includeCustomers: !!flags.includeCustomers });
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
