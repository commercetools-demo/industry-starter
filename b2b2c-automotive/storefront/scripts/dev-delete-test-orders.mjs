// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Developer tool (workstream O-07): removes the TEST orders the checkout checks leave behind.
//
//   node --env-file=.env.local scripts/dev-delete-test-orders.mjs [--before 2026-10-13] [--dry-run]
//
// Only orders with `custom.isTest = true` (set by the storefront outside production, type malva-checkout) are touched. For each one:
// its recurring orders are cancelled, the order is deleted, then the payments the order referenced are deleted. Orders without the flag
// are skipped, and so are their payments. Stripe-side test data is left alone. The API client in the environment needs manage_orders,
// manage_payments and manage_recurring_orders (a missing scope is reported, never ignored silently). Refuses any project other than
// spec-test-b2b2c-automotive. Prints ids and counts only: no email, no address, no secret.
import { pathToFileURL } from 'node:url';

export const PROJECT_KEY = 'spec-test-b2b2c-automotive';
export const EXIT = { ok: 0, failed: 1, usage: 64 };

const isTestOrder = (order) => order?.custom?.fields?.isTest === true;
const statusOf = (error) => (typeof error === 'object' && error !== null ? error.statusCode : undefined);

/** `--before <date>` and `--dry-run`; anything else is a usage error. */
export function parseArgs(argv) {
  const options = { before: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') options.dryRun = true;
    else if (argv[i] === '--before') {
      const date = new Date(argv[(i += 1)] ?? '');
      if (Number.isNaN(date.getTime())) throw new Error('--before needs a valid date, for example 2026-10-13');
      options.before = date;
    } else throw new Error(`Unknown argument ${argv[i]}`);
  }
  return options;
}

/**
 * `api` is a platform SDK request builder (`apiRoot`). Returns counts; `failures` lists `{ id, step, status }` (no personal data).
 * Deleting a payment of a test order is allowed only here, after the order itself was recognised as a test order.
 */
export async function cleanupTestOrders(api, { before, dryRun = false, log = () => undefined } = {}) {
  const summary = { found: 0, skipped: 0, deletedOrders: 0, deletedPayments: 0, cancelledRecurringOrders: 0, failures: [] };
  const where = ['custom(fields(isTest=true))', ...(before ? [`createdAt < "${before.toISOString()}"`] : [])].join(' and ');
  const { body } = await api.orders().get({ queryArgs: { where, limit: 500, sort: 'createdAt asc' } }).execute();
  for (const order of body.results) {
    summary.found += 1;
    if (!isTestOrder(order)) {
      summary.skipped += 1; // defence in depth: the query already filtered, a fake or changed result must not be deleted
      continue;
    }
    const paymentIds = (order.paymentInfo?.payments ?? []).map((p) => p.id);
    if (dryRun) {
      log(`would delete order ${order.id} and ${paymentIds.length} payment(s)`);
      continue;
    }
    try {
      const { body: recurring } = await api.recurringOrders().get({ queryArgs: { where: `originOrder(id="${order.id}")`, limit: 50 } }).execute();
      for (const ro of recurring.results) {
        if (ro.recurringOrderState === 'Canceled') continue;
        await api
          .recurringOrders()
          .withId({ ID: ro.id })
          .post({ body: { version: ro.version, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'test order cleanup' } }] } })
          .execute();
        summary.cancelledRecurringOrders += 1;
      }
    } catch (error) {
      summary.failures.push({ id: order.id, step: 'recurring-orders', status: statusOf(error) });
      continue;
    }
    try {
      await api.orders().withId({ ID: order.id }).delete({ queryArgs: { version: order.version } }).execute();
      summary.deletedOrders += 1;
    } catch (error) {
      summary.failures.push({ id: order.id, step: 'order', status: statusOf(error) });
      continue;
    }
    for (const paymentId of paymentIds) {
      try {
        const { body: payment } = await api.payments().withId({ ID: paymentId }).get().execute();
        await api.payments().withId({ ID: paymentId }).delete({ queryArgs: { version: payment.version } }).execute();
        summary.deletedPayments += 1;
      } catch (error) {
        summary.failures.push({ id: paymentId, step: 'payment', status: statusOf(error) });
      }
    }
    log(`deleted order ${order.id}`);
  }
  return summary;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return EXIT.usage;
  }
  const env = process.env;
  if (env.CTP_PROJECT_KEY !== PROJECT_KEY) {
    console.error(`Refusing to run: CTP_PROJECT_KEY is not ${PROJECT_KEY}`);
    return EXIT.usage;
  }
  const [{ ClientBuilder }, { createApiBuilderFromCtpClient }] = await Promise.all([import('@commercetools/ts-client'), import('@commercetools/platform-sdk')]);
  const client = new ClientBuilder()
    .withProjectKey(env.CTP_PROJECT_KEY)
    .withClientCredentialsFlow({ host: env.CTP_AUTH_URL, projectKey: env.CTP_PROJECT_KEY, credentials: { clientId: env.CTP_CLIENT_ID, clientSecret: env.CTP_CLIENT_SECRET }, scopes: env.CTP_SCOPES.split(/\s+/).filter(Boolean) })
    .withHttpMiddleware({ host: env.CTP_API_URL })
    .build();
  const api = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.CTP_PROJECT_KEY });
  const summary = await cleanupTestOrders(api, { ...options, log: console.log });
  console.log(JSON.stringify(summary));
  return summary.failures.length ? EXIT.failed : EXIT.ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    () => {
      console.error('Cleanup failed (see the status above; no details are printed)');
      process.exit(EXIT.failed);
    },
  );
}
