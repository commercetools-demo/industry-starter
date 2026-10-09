import { collectSubject, findCustomer, type Subject } from './collect';
import { collOf, getAdminRoot, isMain, objectsOf, parseFlags, type Root } from './lib';
import { realSleep, withRetry } from '../seed/lib';

/**
 * Erases one patient: every resource and custom object found by `collectSubject`, deleted with `dataErasure=true` (a plain
 * DELETE leaves the platform's Messages and internal logs behind). Reports ids only, never names, emails or values.
 *
 *   npx tsx scripts/privacy/erase-patient.ts <customerId|email> [--dry-run] [--confirm <customerId>]
 *
 * Same client and project guard as the seed scripts. A real run needs `--confirm <customerId>` (the id this run resolved), so a
 * mistyped email cannot erase someone else. Order: orders, carts, payments, reviews, shopping lists, quotes, discount codes,
 * business units, custom objects, and the customer last (deleting a Customer alone keeps its carts and orders).
 */
export interface EraseOptions {
  dryRun: boolean;
  /** Must equal the resolved customer id on a real run. */
  confirm?: string;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface EraseReport {
  customerId: string;
  dryRun: boolean;
  deleted: { kind: string; id: string }[];
  /** Not deletable through dataErasure: handled differently, listed so nothing is forgotten. */
  notErasable: { kind: string; id: string; action: string }[];
}

const dataErasure = (version: number) => ({ version, dataErasure: true });

/** Deletion order of the commerce resources (referencing resources first); Customer is handled last. */
const ORDER: { kind: keyof Subject['resources']; collection: string }[] = [
  { kind: 'Order', collection: 'orders' },
  { kind: 'Cart', collection: 'carts' },
  { kind: 'Payment', collection: 'payments' },
  { kind: 'Review', collection: 'reviews' },
  { kind: 'ShoppingList', collection: 'shoppingLists' },
  { kind: 'Quote', collection: 'quotes' },
  { kind: 'QuoteRequest', collection: 'quoteRequests' },
  { kind: 'StagedQuote', collection: 'stagedQuotes' },
  { kind: 'DiscountCode', collection: 'discountCodes' },
];

export async function erasePatient(root: Root, idOrEmail: string, o: EraseOptions): Promise<EraseReport | null> {
  const log = o.log ?? console.log;
  const customer = await findCustomer(root, idOrEmail);
  if (!customer) {
    log('no customer found');
    return null;
  }
  const customerId = customer.id as string;
  if (!o.dryRun && o.confirm !== customerId) {
    throw new Error(`Refusing to erase: pass --confirm ${customerId} to confirm this is the customer to erase (use --dry-run first).`);
  }
  const subject = await collectSubject(root, customer);
  const report: EraseReport = { customerId, dryRun: o.dryRun, deleted: [], notErasable: [] };
  const pause = o.sleep ?? realSleep;

  const erase = async (kind: string, id: string, run: () => Promise<unknown>) => {
    if (!o.dryRun) {
      await withRetry(run, o.sleep);
      await pause(50);
    }
    report.deleted.push({ kind, id });
    log(`${o.dryRun ? 'would delete' : 'deleted'}  ${kind} ${id}`);
  };

  for (const { kind, collection } of ORDER) {
    for (const r of subject.resources[kind]) {
      await erase(kind, r.id as string, () => collOf(root, collection).withId({ ID: r.id as string }).delete({ queryArgs: dataErasure(r.version as number) }).execute());
    }
  }

  // Business units: a unit shared with other associates only loses this associate; a sole-associate unit is erased.
  for (const bu of subject.resources.BusinessUnit) {
    const associates = (bu.associates as { customer?: { id?: string } }[] | undefined) ?? [];
    if (associates.every((a) => a.customer?.id === customerId)) {
      await erase('BusinessUnit', bu.id as string, () => collOf(root, 'businessUnits').withId({ ID: bu.id as string }).delete({ queryArgs: dataErasure(bu.version as number) }).execute());
    } else {
      report.notErasable.push({ kind: 'BusinessUnit', id: bu.id as string, action: 'shared: associate removed, unit kept' });
      log(`${o.dryRun ? 'would remove' : 'removed'}  associate from BusinessUnit ${String(bu.id)}`);
      if (!o.dryRun) {
        await withRetry(() => collOf(root, 'businessUnits').withId({ ID: bu.id as string }).post({ body: { version: bu.version, actions: [{ action: 'removeAssociate', customer: { typeId: 'customer', id: customerId } }] } }).execute(), o.sleep);
      }
    }
  }

  // Recurring orders have no dataErasure DELETE: cancel them so nothing is generated for an erased person, and report them.
  for (const r of subject.recurringOrders) {
    report.notErasable.push({ kind: 'RecurringOrder', id: r.id as string, action: 'cancelled; no dataErasure DELETE exists for this resource' });
    log(`${o.dryRun ? 'would cancel' : 'cancelled'}  RecurringOrder ${String(r.id)}`);
    if (!o.dryRun) {
      await withRetry(() => collOf(root, 'recurringOrders').withId({ ID: r.id as string }).post({ body: { version: r.version, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'erasure' } }] } }).execute(), o.sleep);
    }
  }

  for (const [container, hits] of Object.entries(subject.objects)) {
    for (const h of hits) {
      await erase(`CustomObject ${container}`, h.key, () => objectsOf(root).withContainerAndKey({ container, key: h.key }).delete({ queryArgs: dataErasure(h.version) }).execute());
    }
  }

  await erase('Customer', customerId, () => collOf(root, 'customers').withId({ ID: customerId }).delete({ queryArgs: dataErasure(customer.version as number) }).execute());
  log(`${o.dryRun ? 'dry run: ' : ''}${report.deleted.length} resource(s) ${o.dryRun ? 'would be ' : ''}deleted with dataErasure=true; ${subject.resources.Message.length} message(s) are removed with them`);
  return report;
}

async function main() {
  const argv = process.argv.slice(2);
  const target = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--confirm');
  if (!target) throw new Error('Usage: erase-patient.ts <customerId|email> [--dry-run] [--confirm <customerId>]');
  const flags = parseFlags(argv);
  const { root } = await getAdminRoot();
  await erasePatient(root, target, { dryRun: flags.dryRun, confirm: flags.confirm });
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
