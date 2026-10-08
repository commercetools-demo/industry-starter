import { runDeletion } from './deletion';
import { getAdminRoot, isMain, makeCtx, parseFlags, PROJECT_KEY, type Flags } from './lib';

/**
 * Deletes ONLY the resources the seed created (key starts with `mlv-`), in dependency order, so the project can be rebuilt.
 * Sample data, the `usa` and `europe` zones, customers, carts and orders are never touched.
 *
 *   npx tsx scripts/seed/reset-seed.ts --dry-run
 *   npx tsx scripts/seed/reset-seed.ts --confirm spec-test-b2c-healthcare
 */
export function checkConfirm(flags: Flags): void {
  if (!flags.dryRun && flags.confirm !== PROJECT_KEY) throw new Error(`Add --confirm ${PROJECT_KEY} to delete (or --dry-run to list).`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  checkConfirm(flags);
  const { root } = await getAdminRoot();
  await runDeletion(makeCtx(root, flags), 'seed');
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
