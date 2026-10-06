import { getAdminRoot } from './lib';

/** Deletes throwaway QA customers (email like qa-*@example.com) created by manual/browser tests. */
async function main() {
  const { root } = getAdminRoot();
  const res = await root.customers().get({ queryArgs: { where: 'email like "qa-%@example.com"', limit: 100 } }).execute();
  for (const c of res.body.results) {
    await root.customers().withId({ ID: c.id }).delete({ queryArgs: { version: c.version } }).execute();
    console.log('deleted customer', c.id);
  }
  console.log(`done: ${res.body.results.length} customer(s)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
