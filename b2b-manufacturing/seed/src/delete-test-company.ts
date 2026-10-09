import { getAdminRoot } from './lib';

/** Deletes a throwaway company registered through the site and its customers. Refuses any key that does not start with `mpw-test-`. */
const key = process.argv[2];
if (!key || !key.startsWith('mpw-test-')) {
  console.error('Usage: tsx src/delete-test-company.ts mpw-test-<suffix>   (refuses other keys)');
  process.exit(1);
}
const { root } = await getAdminRoot();
const unit = (await root.businessUnits().withKey({ key }).get().execute()).body;
const customerIds = (unit.associates ?? []).map((a) => a.customer.id);
// Quotes, staged quotes, quote requests, orders and carts reference the unit, so they go first (in dependency order).
const where = [`businessUnit(key="${key}")`];
const sweep = async (name: string, api: { get: (a: object) => { execute: () => Promise<{ body: { results: { id: string; version: number }[] } }> }; withId: (a: { ID: string }) => { delete: (a: object) => { execute: () => Promise<unknown> } } }) => {
  const { results } = (await api.get({ queryArgs: { where, limit: 100 } }).execute()).body;
  for (const r of results) await api.withId({ ID: r.id }).delete({ queryArgs: { version: r.version } }).execute();
  if (results.length) console.log(`deleted ${results.length} ${name}`);
};
await sweep('quote(s)', root.quotes() as never);
await sweep('staged quote(s)', root.stagedQuotes() as never);
await sweep('quote request(s)', root.quoteRequests() as never);
await sweep('order(s)', root.orders() as never);
await sweep('cart(s)', root.carts() as never);
const unit2 = (await root.businessUnits().withKey({ key }).get().execute()).body;
await root.businessUnits().withKey({ key }).delete({ queryArgs: { version: unit2.version } }).execute();
for (const id of customerIds) {
  const c = (await root.customers().withId({ ID: id }).get().execute()).body;
  await root.customers().withId({ ID: id }).delete({ queryArgs: { version: c.version } }).execute();
}
console.log(`deleted ${key} and ${customerIds.length} customer(s)`);
