import 'server-only';
import type { Order as CtOrder, OrderEdit } from '@commercetools/platform-sdk';
import type { Proposal, ProposalsResponse } from '../types';
import { getLocalizedString } from '../utils';
import { getApiRoot } from './client';

/** The order does not exist or is not the customer's, or the edit is not a (pending) proposal: all look the same. */
export class ProposalNotFoundError extends Error {
  constructor() {
    super('Proposal not found');
    this.name = 'ProposalNotFoundError';
  }
}
/** The order no longer accepts edits (shipped, completed, cancelled, inventory mode not None) or the preview failed. */
export class ProposalNotEditableError extends Error {
  constructor() {
    super('Order is not editable');
    this.name = 'ProposalNotEditableError';
  }
}
/** The order or the edit changed since the customer saw the proposal (HTTP 409). */
export class ProposalConflictError extends Error {
  constructor() {
    super('Proposal is stale');
    this.name = 'ProposalConflictError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const statusOf = (e: unknown): number | undefined => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { statusCode, code } = e as { statusCode?: unknown; code?: unknown };
  return typeof statusCode === 'number' ? statusCode : typeof code === 'number' ? code : undefined;
};
const idLiteral = (id: string): string => id.replace(/["\\]/g, '');

/** Orders accept an edit only with inventory mode `None` (D-031), not cancelled/complete and not shipped/delivered. */
export function isOrderEditable(order: Pick<CtOrder, 'inventoryMode' | 'orderState' | 'shipmentState'>): boolean {
  if ((order.inventoryMode ?? 'None') !== 'None') return false;
  if (order.orderState === 'Cancelled' || order.orderState === 'Complete') return false;
  return order.shipmentState !== 'Shipped' && order.shipmentState !== 'Delivered';
}

interface ProposalFields {
  originalLineItemId: string;
  substituteSku: string;
  status: string;
  note?: string;
}

/** The proposal fields of an edit, or `null` when it is not a `substitution-proposal` edit (other edits are ignored). */
function proposalFields(edit: OrderEdit): ProposalFields | null {
  const fields: unknown = edit.custom?.fields;
  if (!isRecord(fields)) return null;
  const type: unknown = (edit.custom?.type as { obj?: { key?: unknown } } | undefined)?.obj;
  if (isRecord(type) && type.key !== 'substitution-proposal') return null;
  const { originalLineItemId, substituteSku, status, note } = fields;
  if (typeof originalLineItemId !== 'string' || typeof substituteSku !== 'string' || typeof status !== 'string') return null;
  return { originalLineItemId, substituteSku, status, ...(typeof note === 'string' && note !== '' ? { note } : {}) };
}

async function fetchOrder(orderId: string, customerId: string): Promise<CtOrder> {
  let order: CtOrder;
  try {
    order = (await getApiRoot().orders().withId({ ID: orderId }).get().execute()).body;
  } catch (e) {
    if (statusOf(e) === 404) throw new ProposalNotFoundError();
    throw e;
  }
  if (!order.customerId || order.customerId !== customerId) throw new ProposalNotFoundError();
  return order;
}

async function fetchEdit(editId: string): Promise<OrderEdit> {
  try {
    return (await getApiRoot().orders().edits().withId({ ID: editId }).get().execute()).body;
  } catch (e) {
    if (statusOf(e) === 404) throw new ProposalNotFoundError();
    throw e;
  }
}

function buildProposal(edit: OrderEdit, fields: ProposalFields, order: CtOrder, locale: string): Proposal {
  const original = order.lineItems.find((l) => l.id === fields.originalLineItemId);
  const base = {
    editId: edit.id,
    originalLineItemId: fields.originalLineItemId,
    originalName: original ? getLocalizedString(original.name, locale) : '',
    substituteSku: fields.substituteSku,
    ...(fields.note ? { note: fields.note } : {}),
  };
  const result = edit.result;
  if (result.type !== 'PreviewSuccess') {
    return { ...base, substituteName: fields.substituteSku, priceDifference: { centAmount: 0, currencyCode: order.totalPrice.currencyCode }, editable: false };
  }
  const preview = result.preview;
  const substitute = preview.lineItems.find((l) => l.variant.sku === fields.substituteSku);
  return {
    ...base,
    substituteName: substitute ? getLocalizedString(substitute.name, locale) : fields.substituteSku,
    priceDifference: { centAmount: preview.totalPrice.centAmount - order.totalPrice.centAmount, currencyCode: preview.totalPrice.currencyCode },
    newTotal: { centAmount: preview.totalPrice.centAmount, currencyCode: preview.totalPrice.currencyCode },
    editable: isOrderEditable(order),
  };
}

/**
 * Pending proposals of the customer's order (with an Order Edit preview each) and the original line ids of declined ones.
 * Edits of other types, applied edits and edits of other orders are ignored. Not the customer's order: `ProposalNotFoundError`.
 */
export async function getProposalsForOrder(orderId: string, customerId: string, locale: string): Promise<ProposalsResponse> {
  const order = await fetchOrder(orderId, customerId);
  const list = (
    await getApiRoot()
      .orders()
      .edits()
      .get({ queryArgs: { where: `resource(id="${idLiteral(orderId)}")`, expand: ['custom.type'], limit: 100, sort: 'createdAt asc' } })
      .execute()
  ).body;

  const proposals: Proposal[] = [];
  const removalRequested: string[] = [];
  for (const listed of list.results) {
    const fields = proposalFields(listed);
    if (!fields || listed.result.type === 'Applied') continue;
    if (fields.status === 'declined') {
      removalRequested.push(fields.originalLineItemId);
    } else if (fields.status === 'pending') {
      // A list answer carries no preview; a single GET computes it against the current order version.
      const edit = await fetchEdit(listed.id);
      proposals.push(buildProposal(edit, fields, order, locale));
    }
  }
  return { proposals, removalRequested };
}

/** Loads and checks a pending, editable proposal of the customer's order. */
async function loadActionable(editId: string, customerId: string): Promise<{ edit: OrderEdit; order: CtOrder }> {
  const edit = await fetchEdit(editId);
  const order = await fetchOrder(edit.resource.id, customerId);
  const fields = proposalFields(edit);
  if (!fields || fields.status !== 'pending' || edit.result.type === 'Applied') throw new ProposalNotFoundError();
  if (!isOrderEditable(order) || edit.result.type === 'PreviewFailure') throw new ProposalNotEditableError();
  return { edit, order };
}

async function setStatus(edit: OrderEdit, status: 'applied' | 'declined'): Promise<void> {
  await getApiRoot()
    .orders()
    .edits()
    .withId({ ID: edit.id })
    .post({ body: { version: edit.version, actions: [{ action: 'setCustomField', name: 'status', value: status }] } })
    .execute();
}

/** Applies the Order Edit with both versions, then marks the proposal `applied`. Version conflict: `ProposalConflictError`. */
export async function acceptProposal(editId: string, customerId: string): Promise<void> {
  const { edit, order } = await loadActionable(editId, customerId);
  let applied: OrderEdit;
  try {
    applied = (
      await getApiRoot()
        .orders()
        .edits()
        .withId({ ID: edit.id })
        .apply()
        .post({ body: { editVersion: edit.version, resourceVersion: order.version } })
        .execute()
    ).body;
  } catch (e) {
    if (statusOf(e) === 409) throw new ProposalConflictError();
    throw e;
  }
  try {
    await setStatus(applied, 'applied');
  } catch (e) {
    // The order is already edited and the edit's result is `Applied`, which is what hides it; do not fail the shopper.
    console.error('Could not mark the proposal applied', e instanceof Error ? e.message : e);
  }
}

/** Records the removal request (`status = declined`). The edit is never applied. */
export async function declineProposal(editId: string, customerId: string): Promise<void> {
  const { edit } = await loadActionable(editId, customerId);
  try {
    await setStatus(edit, 'declined');
  } catch (e) {
    if (statusOf(e) === 409) throw new ProposalConflictError();
    throw e;
  }
}
