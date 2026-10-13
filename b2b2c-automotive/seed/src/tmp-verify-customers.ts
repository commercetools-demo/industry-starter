// TEMPORARY, NOT COMMITTED: verifies every customer in the project (all stores, any key).
//   npx tsx src/tmp-verify-customers.ts --dry-run
//   npx tsx src/tmp-verify-customers.ts
import { fail, getAdmin, parseArgs } from './lib';

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const { api, env } = await getAdmin();
  const customers = await api.list('customers');
  const todo = customers.filter((c) => c.isEmailVerified !== true);
  console.log(`${env.projectKey}: ${customers.length} customers, ${todo.length} unverified${dryRun ? ' (dry run)' : ''}`);
  let done = 0;
  for (const c of todo) {
    if (dryRun) { console.log(`  would verify ${String(c.email)}`); continue; }
    try {
      await api.verifyCustomerEmail(c);
      done++;
      console.log(`  verified ${String(c.email)}`);
    } catch (e) {
      console.log(`  FAILED ${String(c.email)}: ${(e as Error).message}`);
    }
  }
  if (!dryRun) console.log(`verified ${done} of ${todo.length}`);
}

main().catch(fail);
