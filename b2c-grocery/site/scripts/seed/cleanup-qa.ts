import { getAdminRoot } from './lib';

/** Deletes throwaway QA customers (email like qa-*@example.com) created by manual/browser tests, with their orders and carts. */
async function main() {
  const { root } = getAdminRoot();
  const res = await root.customers().get({ queryArgs: { limit: 500 } }).execute();
  const qa = res.body.results.filter((c) => /^qa-.*@example\.com$/.test(c.email));
  let orders = 0;
  let carts = 0;
  for (const c of qa) {
    const where = `customerId="${c.id}"`;
    for (const o of (await root.orders().get({ queryArgs: { where, limit: 500 } }).execute()).body.results) {
      await root.orders().withId({ ID: o.id }).delete({ queryArgs: { version: o.version } }).execute();
      orders += 1;
    }
    for (const cart of (await root.carts().get({ queryArgs: { where, limit: 500 } }).execute()).body.results) {
      await root.carts().withId({ ID: cart.id }).delete({ queryArgs: { version: cart.version } }).execute();
      carts += 1;
    }
    // Re-read: deleting orders or carts does not change the customer, but its version is the safest input.
    const fresh = (await root.customers().withId({ ID: c.id }).get().execute()).body;
    await root.customers().withId({ ID: c.id }).delete({ queryArgs: { version: fresh.version } }).execute();
    console.log('deleted customer', c.id);
  }
  console.log(`done: ${qa.length} customer(s), ${orders} order(s), ${carts} cart(s)`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
