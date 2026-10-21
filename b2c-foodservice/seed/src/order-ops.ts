// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { K } from './data/base';
import { assertRemoteKey, assertSafeProject, fail, isMainModule, loadEnv } from './lib';

/**
 * Dev tool for orders (workstream K). Subcommand `state` moves an order along the seeded collection chain so the confirmation's
 * tracker can be seen end to end (the store does this in the Merchant Center in real life):
 *
 *   npm run seed:order -- state --order-number MC-XXXXXXXXXX --to preparing --dry-run
 *   npm run seed:order -- state --order-number MC-XXXXXXXXXX --to ready-for-collection
 *
 * It refuses a project key other than EXPECTED_PROJECT_KEY (the same two guards as every seed script), moves one step at a
 * time (no skipping, no going back), and prints the new state. L adds more subcommands to this file.
 */
export const STATE_CHAIN = [K.orderOrdered, K.orderPreparing, K.orderReady, K.orderCollected] as const;

const SHORT: Record<string, string> = {
  ordered: K.orderOrdered,
  preparing: K.orderPreparing,
  'ready-for-collection': K.orderReady,
  collected: K.orderCollected,
};

/** The project guard of every seed script, re-exported so the test can show that a foreign key is refused. */
export const guardProject = assertSafeProject;

export type Plan = { kind: 'noop' } | { kind: 'move'; to: string } | { kind: 'refuse'; reason: string };

/** The next step for an order currently in `current` (undefined: no state yet) when the operator asks for `to` (a short name). */
export function planTransition(current: string | undefined, to: string): Plan {
  const target = SHORT[to];
  if (!target) return { kind: 'refuse', reason: `unknown state "${to}" (use ${Object.keys(SHORT).join(', ')})` };
  const from = current === undefined ? -1 : STATE_CHAIN.indexOf(current as (typeof STATE_CHAIN)[number]);
  if (current !== undefined && from < 0) return { kind: 'refuse', reason: `the order is in "${current}", which is not part of the collection chain` };
  const next = STATE_CHAIN.indexOf(target as (typeof STATE_CHAIN)[number]);
  if (next === from) return { kind: 'noop' };
  if (next < from) return { kind: 'refuse', reason: 'an order cannot go back to an earlier state' };
  if (next > from + 1) return { kind: 'refuse', reason: `cannot skip a state: next is "${STATE_CHAIN[from + 1]}"` };
  return { kind: 'move', to: target };
}

/** What the tool needs from commercetools (an in-memory stand-in in the tests). */
export interface OrdersPort {
  findByNumber(orderNumber: string): Promise<{ id: string; version: number; stateKey?: string } | undefined>;
  transition(id: string, version: number, stateKey: string): Promise<void>;
}

export async function runState(port: OrdersPort, args: { orderNumber: string; to: string; dryRun: boolean }, log: (line: string) => void = console.log): Promise<number> {
  if (!/^MC-[0-9A-Z]{10}(-[A-H])?$/.test(args.orderNumber)) {
    log(`REFUSED "${args.orderNumber}" is not an order number of this shop`);
    return 1;
  }
  const order = await port.findByNumber(args.orderNumber);
  if (!order) {
    log(`REFUSED no order with number ${args.orderNumber}`);
    return 1;
  }
  const plan = planTransition(order.stateKey, args.to);
  if (plan.kind === 'refuse') {
    log(`REFUSED ${plan.reason}`);
    return 1;
  }
  if (plan.kind === 'noop') {
    log(`${args.orderNumber} is already ${order.stateKey}`);
    return 0;
  }
  if (args.dryRun) {
    log(`dry run: ${args.orderNumber} ${order.stateKey ?? '(no state)'} -> ${plan.to}`);
    return 0;
  }
  await port.transition(order.id, order.version, plan.to);
  log(`${args.orderNumber} is now ${plan.to}`);
  return 0;
}

/** The commercetools side of `OrdersPort`. */
export function sdkOrders(root: ReturnType<ReturnType<typeof createApiBuilderFromCtpClient>['withProjectKey']>): OrdersPort {
  return {
    async findByNumber(orderNumber) {
      try {
        const { body } = await root.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ['state'] } }).execute();
        return { id: body.id, version: body.version, ...(body.state?.obj?.key ? { stateKey: body.state.obj.key } : {}) };
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) return undefined;
        throw e;
      }
    },
    async transition(id, version, stateKey) {
      await root.orders().withId({ ID: id }).post({ body: { version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: stateKey }, force: false }] } }).execute();
    },
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  if (argv[0] !== 'state') throw new Error('usage: seed:order -- state --order-number MC-... --to preparing|ready-for-collection|collected [--dry-run]');
  const { env } = loadEnv();
  const client = new ClientBuilder()
    .withProjectKey(env.projectKey)
    .withClientCredentialsFlow({
      host: env.authUrl,
      projectKey: env.projectKey,
      credentials: { clientId: env.clientId, clientSecret: env.clientSecret },
      scopes: env.scopes.split(/[\s,]+/).filter(Boolean),
      httpClient: fetch,
    })
    .withHttpMiddleware({ host: env.apiUrl, httpClient: fetch })
    .build();
  const root = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.projectKey });
  assertRemoteKey((await root.get().execute()).body.key, env.projectKey, env.expectedProjectKey);
  const code = await runState(sdkOrders(root), { orderNumber: get('--order-number') ?? '', to: get('--to') ?? '', dryRun: argv.includes('--dry-run') });
  if (code !== 0) process.exit(code);
}

if (isMainModule(import.meta.url)) main().catch(fail);
