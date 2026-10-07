import type { OrderEditDraft } from '@commercetools/platform-sdk';
import { createQaOrder, QA_PASSWORD, QA_SKUS } from './create-qa-order';
import { getAdminRoot, type Root } from './lib';

/**
 * Creates a substitution proposal (an Order Edit of custom type `substitution-proposal`, status `pending`) on a QA order,
 * the way Merchant Center staff would (there is no Merchant Center screen for it, see plan/recipes/create-substitution-proposal.md).
 *
 *   npx tsx scripts/seed/create-qa-substitution.ts                      # new QA customer + order, proposal on the whole-milk line
 *   npx tsx scripts/seed/create-qa-substitution.ts --order <orderId>    # proposal on an existing order
 *       [--line-sku WHOLE-MILK-1EACH] [--substitute-sku OAT-DRINK-1EACH] [--note "text"]
 *
 * The edit removes the original line and adds the substitute line (quantity kept). It is NOT applied: the customer
 * accepts or declines it on the order detail page. Delete everything with `npx tsx scripts/seed/cleanup-qa.ts`.
 */
export const DEFAULT_LINE_SKU = QA_SKUS[1]; // whole milk 1 L
export const DEFAULT_SUBSTITUTE_SKU = 'OAT-DRINK-1EACH'; // the seeded substitute of whole milk
export const DEFAULT_NOTE = 'Whole milk is out of stock today.';

export interface SubstitutionOptions {
  orderId?: string;
  lineSku: string;
  substituteSku: string;
  note: string;
}

export function parseArgs(argv: string[]): SubstitutionOptions {
  const get = (name: string) => {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
    return value;
  };
  const orderId = get('--order');
  return {
    ...(orderId ? { orderId } : {}),
    lineSku: get('--line-sku') ?? DEFAULT_LINE_SKU,
    substituteSku: get('--substitute-sku') ?? DEFAULT_SUBSTITUTE_SKU,
    note: get('--note') ?? DEFAULT_NOTE,
  };
}

interface OrderLike {
  id: string;
  lineItems: { id: string; quantity: number; variant: { sku?: string } }[];
}

/** The Order Edit draft: remove the original line, add the substitute (same quantity), proposal fields `pending`. */
export function proposalDraft(order: OrderLike, options: Pick<SubstitutionOptions, 'lineSku' | 'substituteSku' | 'note'>): OrderEditDraft {
  const line = order.lineItems.find((l) => l.variant.sku === options.lineSku);
  if (!line) throw new Error(`Order ${order.id} has no line with SKU ${options.lineSku}`);
  if (options.substituteSku === options.lineSku) throw new Error('The substitute must be a different SKU');
  return {
    resource: { typeId: 'order', id: order.id },
    stagedActions: [
      { action: 'removeLineItem', lineItemId: line.id },
      {
        action: 'addLineItem',
        sku: options.substituteSku,
        quantity: line.quantity,
        // The substitute line keeps the shopper's "no further substitution" stance.
        custom: { type: { typeId: 'type', key: 'line-substitution' }, fields: { substitutionPreference: 'none' } },
      },
    ],
    comment: `Substitution proposal: ${options.lineSku} -> ${options.substituteSku}`,
    custom: {
      type: { typeId: 'type', key: 'substitution-proposal' },
      fields: { originalLineItemId: line.id, substituteSku: options.substituteSku, status: 'pending', note: options.note },
    },
  };
}

export async function createQaSubstitution(root: Root, options: SubstitutionOptions) {
  let orderId = options.orderId;
  let created: { email: string } | undefined;
  if (!orderId) {
    const qa = await createQaOrder(root, { status: 'processing', orders: 1 });
    orderId = qa.orders[0].id;
    created = { email: qa.email };
  }
  const order = (await root.orders().withId({ ID: orderId }).get().execute()).body;
  const edit = (await root.orders().edits().post({ body: proposalDraft(order, options) }).execute()).body;
  return { orderId, editId: edit.id, ...(created ?? {}) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { root } = getAdminRoot();
  const r = await createQaSubstitution(root, options);
  if (r.email) {
    console.log(`email:      ${r.email}`);
    console.log(`password:   ${QA_PASSWORD}  (fixed throwaway)`);
  }
  console.log(`order:      ${r.orderId}`);
  console.log(`edit:       ${r.editId}  (pending, not applied)`);
  console.log(`Sign in and open /account/orders/${r.orderId}. Delete with: npx tsx scripts/seed/cleanup-qa.ts`);
}

if (process.argv[1]?.endsWith('create-qa-substitution.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
