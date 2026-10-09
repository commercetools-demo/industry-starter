import { runDeletion } from './deletion';
import { getAdminRoot, isMain, makeCtx, parseFlags, PROJECT_KEY, type Flags } from './lib';

/**
 * Deletes the sample (furniture) data: every resource WITHOUT the `mlv-` key prefix, in dependency order.
 *
 *   npx tsx scripts/seed/cleanup-sample.ts --dry-run
 *   npx tsx scripts/seed/cleanup-sample.ts --confirm spec-test-b2c-healthcare
 *
 * A real run needs `--confirm <project key>`; the dry run lists what would go and writes nothing.
 * Zones `usa` and `europe` are kept. Customers are never deleted. Prefixed (seeded) resources are never touched.
 */
export function checkConfirm(flags: Flags): void {
  if (!flags.dryRun && flags.confirm !== PROJECT_KEY) throw new Error(`Add --confirm ${PROJECT_KEY} to delete (or --dry-run to list).`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  checkConfirm(flags);
  const { root } = await getAdminRoot();
  await runDeletion(makeCtx(root, flags), 'sample');
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
