// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { connectRoot, guardProject, ORDER_NUMBER_RE, sdkOrders, type ApiRoot, type OrdersPort, runState } from './order-ops';
import { fail, isExampleEmail, isMainModule, loadEnv } from './lib';

/**
 * The safe way for the end-to-end journeys (workstream Q) to move a TEST order along the collection states
 * (`mcf-order-preparing`, `mcf-order-ready-for-collection`, `mcf-order-collected`). It wraps `seed:order -- state` (same state
 * chain: one step at a time, no skipping, no going back) and adds the guards that make it safe to point at a shared project:
 *
 *   npm run seed:advance-order -- --order MC-XXXXXXXXXX --to preparing|ready-for-collection|collected --confirm <projectKey> [--dry-run]
 *
 * Refuses, before the first write: a project key other than EXPECTED_PROJECT_KEY (the two guards of every seed script: the
 * configured key, then the key the API itself reports), a `--confirm` that is not the project key (also with `--dry-run`), a
 * number that is not one of this shop's order numbers, and any order whose customer is not an `@example.com` test customer
 * (a member order: the customer is read; a guest order: the `customerEmail` on the order; when both exist both must be
 * `@example.com`). Output never contains an email address. `--dry-run` reads and prints the plan and writes nothing.
 */
export const ADVANCE_TARGETS = ['preparing', 'ready-for-collection', 'collected'] as const;

/** What the owner check needs from commercetools (an in-memory stand-in in the tests). */
export interface OrderOwnerPort {
  /** The customer id (member order) and the email (guest order) recorded on the order; undefined when there is no such order. */
  ownerOf(orderNumber: string): Promise<{ customerId?: string; customerEmail?: string } | undefined>;
  /** The email of a customer, read only to test its domain and never printed; undefined when the customer does not exist. */
  customerEmail(customerId: string): Promise<string | undefined>;
}

export type AdvancePort = OrdersPort & OrderOwnerPort;

export type OwnerCheck = { ok: true } | { ok: false; reason: string };

/** Passes only an order whose every known customer email is an `@example.com` address. */
export async function checkOwner(port: OrderOwnerPort, orderNumber: string): Promise<OwnerCheck> {
  const owner = await port.ownerOf(orderNumber);
  if (!owner) return { ok: false, reason: `no order with number ${orderNumber}` };
  const emails: (string | undefined)[] = [];
  if (owner.customerId) {
    const email = await port.customerEmail(owner.customerId);
    if (!email) return { ok: false, reason: `the customer of order ${orderNumber} cannot be read` };
    emails.push(email);
  }
  if (owner.customerEmail) emails.push(owner.customerEmail);
  if (emails.length === 0) return { ok: false, reason: `order ${orderNumber} has no customer and no customer email` };
  if (!emails.every(isExampleEmail)) return { ok: false, reason: `order ${orderNumber} belongs to a customer who is not an @example.com test customer` };
  return { ok: true };
}

/** `--confirm` must be the project key; required for a dry run too, so the command line is the same for both. */
export function assertConfirm(confirm: string | undefined, projectKey: string): void {
  if (confirm !== projectKey) throw new Error(`--confirm must equal the project key "${projectKey}"`);
}

export interface AdvanceArgs {
  orderNumber: string;
  to: string;
  dryRun: boolean;
  confirm?: string;
  /** The configured key (SEED_CTP_PROJECT_KEY). */
  projectKey: string;
  /** The independently typed key (EXPECTED_PROJECT_KEY). */
  expectedProjectKey?: string;
}

export function parseAdvanceArgs(argv: string[]): { orderNumber: string; to: string; confirm?: string; dryRun: boolean } {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  return { orderNumber: get('--order') ?? '', to: get('--to') ?? '', confirm: get('--confirm'), dryRun: argv.includes('--dry-run') };
}

/** The guards, then the owner check, then `runState`. Returns the exit code; a failed project or confirm guard throws before any request. */
export async function runAdvance(port: AdvancePort, args: AdvanceArgs, log: (line: string) => void = console.log): Promise<number> {
  guardProject(args.projectKey, args.expectedProjectKey);
  assertConfirm(args.confirm, args.projectKey);
  if (!(ADVANCE_TARGETS as readonly string[]).includes(args.to)) {
    log(`REFUSED --to must be one of ${ADVANCE_TARGETS.join(', ')}`);
    return 1;
  }
  if (!ORDER_NUMBER_RE.test(args.orderNumber)) {
    log(`REFUSED "${args.orderNumber}" is not an order number of this shop`);
    return 1;
  }
  const owner = await checkOwner(port, args.orderNumber);
  if (!owner.ok) {
    log(`REFUSED ${owner.reason}`);
    return 1;
  }
  return runState(port, { orderNumber: args.orderNumber, to: args.to, dryRun: args.dryRun }, log);
}

/** The commercetools side of `OrderOwnerPort`. */
export function sdkOwner(root: ApiRoot): OrderOwnerPort {
  const notFound = (e: unknown): boolean => (e as { statusCode?: number }).statusCode === 404;
  return {
    async ownerOf(orderNumber) {
      try {
        const { body } = await root.orders().withOrderNumber({ orderNumber }).get().execute();
        return { ...(body.customerId ? { customerId: body.customerId } : {}), ...(body.customerEmail ? { customerEmail: body.customerEmail } : {}) };
      } catch (e) {
        if (notFound(e)) return undefined;
        throw e;
      }
    },
    async customerEmail(customerId) {
      try {
        return (await root.customers().withId({ ID: customerId }).get().execute()).body.email;
      } catch (e) {
        if (notFound(e)) return undefined;
        throw e;
      }
    },
  };
}

async function main() {
  const args = parseAdvanceArgs(process.argv.slice(2));
  const { env } = loadEnv(); // first guard, no network
  assertConfirm(args.confirm, env.projectKey); // refused before the first request
  const root = await connectRoot(env); // second guard: the API reports the key we expect
  const port: AdvancePort = { ...sdkOrders(root), ...sdkOwner(root) };
  const code = await runAdvance(port, { ...args, projectKey: env.projectKey, expectedProjectKey: env.expectedProjectKey });
  if (code !== 0) process.exit(code);
}

if (isMainModule(import.meta.url)) main().catch(fail);
