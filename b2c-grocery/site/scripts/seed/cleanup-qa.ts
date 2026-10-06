import { getAdminRoot } from './lib';

/** Deletes throwaway QA customers (email like qa-*@example.com) created by manual/browser tests. */
async function main() {
  const { root } = getAdminRoot();
  const res = await root.customers().get({ queryArgs: { limit: 500 } }).execute();
  const qa = res.body.results.filter((c) => /^qa-.*@example\.com$/.test(c.email));
  for (const c of qa) {
    await root.customers().withId({ ID: c.id }).delete({ queryArgs: { version: c.version } }).execute();
    console.log('deleted customer', c.id);
  }
  console.log(`done: ${qa.length} customer(s)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
