import { slotClaimKey } from '../../lib/clinical/slots';
import { CONTAINER_INVENTORY } from './inventory';
import { byPatientRef, getObject, QUERIES, queryAll, queryObjects, safeEmail, safeId, type Rec, type Root, type ResourceKind } from './lib';

/**
 * Finds everything held about one customer: the 13 resource kinds of the GDPR page (Message through the ids of the others),
 * plus the `malva-*` Custom Objects (the blind spot of every platform tool) and the recurring orders. Used by
 * `subject-access.ts` (reads) and `erase-patient.ts` (deletes what this finds), so the two can never disagree.
 */
export interface QueryNote { kind: string; query: string; count: number }

export interface ObjectHit { container: string; key: string; version: number; value: unknown }

export interface Subject {
  customerId: string;
  email: string;
  patientRef?: string;
  /** Resources by kind (Customer, Cart, Order, Payment, Review, ShoppingList, DiscountCode, BusinessUnit, Quote, QuoteRequest, StagedQuote, Message). */
  resources: Record<Exclude<ResourceKind, 'CustomObject'>, Rec[]>;
  /** Recurring orders: not in the platform's dataErasure list, reported separately. */
  recurringOrders: Rec[];
  /** Custom objects per container. */
  objects: Record<string, ObjectHit[]>;
  /** What was queried, for the report. */
  queries: QueryNote[];
}

const hit = (r: Rec): ObjectHit => ({ container: r.container as string, key: r.key as string, version: r.version as number, value: r.value });
const ratelimitKey = (customerId: string) => `rl-${customerId.replace(/[^-_~.a-zA-Z0-9]/g, '_')}`;
const patientRefOf = (customer: Rec): string | undefined => {
  const v = ((customer.custom as { fields?: Rec } | undefined)?.fields ?? {}).patientRef;
  return typeof v === 'string' ? v : undefined;
};

/** The customer by id or, when `idOrEmail` contains `@`, by (lower-cased) email. Null when not found. */
export async function findCustomer(root: Root, idOrEmail: string): Promise<Rec | null> {
  const where = idOrEmail.includes('@') ? `email="${safeEmail(idOrEmail.toLowerCase())}"` : `id="${safeId(idOrEmail)}"`;
  const found = await queryAll(root, 'customers', where);
  return found[0] ?? null;
}

export async function collectSubject(root: Root, customer: Rec): Promise<Subject> {
  const customerId = safeId(customer.id as string);
  const email = String(customer.email ?? '');
  const patientRef = patientRefOf(customer);
  const queries: QueryNote[] = [];
  const note = (kind: string, query: string, rows: unknown[]) => queries.push({ kind, query, count: rows.length });

  const resources = {} as Subject['resources'];
  for (const spec of QUERIES) {
    const where = spec.where(customerId);
    const rows = spec.kind === 'Customer' ? [customer] : await queryAll(root, spec.collection, where);
    resources[spec.kind] = rows;
    note(spec.kind, `${spec.collection}?where=${where}`, rows);
  }

  // Payments are also reachable only through the carts and orders of this customer (a guest or tender payment carries no customer).
  const known = new Set(resources.Payment.map((p) => p.id as string));
  for (const holder of [...resources.Cart, ...resources.Order]) {
    const refs = ((holder.paymentInfo as { payments?: { id: string }[] } | undefined)?.payments ?? []);
    for (const ref of refs) {
      if (known.has(ref.id)) continue;
      known.add(ref.id);
      const rows = await queryAll(root, 'payments', `id="${safeId(ref.id)}"`);
      resources.Payment.push(...rows);
    }
  }
  note('Payment', 'payments referenced by the carts and orders above', resources.Payment);

  // Discount codes: those whose own cart predicate, or whose cart discount's predicate, names the customer id.
  const discounts = (await queryAll(root, 'cartDiscounts')).filter((d) => String(d.cartPredicate ?? '').includes(customerId));
  const discountIds = new Set(discounts.map((d) => d.id as string));
  resources.DiscountCode = (await queryAll(root, 'discountCodes')).filter(
    (c) => String(c.cartPredicate ?? '').includes(customerId) || ((c.cartDiscounts as { id: string }[] | undefined) ?? []).some((d) => discountIds.has(d.id)),
  );
  note('DiscountCode', `discountCodes and cartDiscounts whose cartPredicate contains the customer id`, resources.DiscountCode);

  const recurringOrders = await queryAll(root, 'recurringOrders', `customer(id="${customerId}")`);
  note('RecurringOrder', `recurringOrders?where=customer(id="${customerId}")`, recurringOrders);

  // ---- Custom Objects, per container, by the link the inventory declares
  const objects: Record<string, ObjectHit[]> = {};
  const add = (container: string, rows: Rec[]) => {
    const list = (objects[container] ??= []);
    for (const r of rows) if (!list.some((x) => x.key === r.key)) list.push(hit(r));
  };
  const cartIds = resources.Cart.map((c) => c.id as string);
  const recurringIds = recurringOrders.map((r) => r.id as string);
  for (const info of CONTAINER_INVENTORY) {
    objects[info.container] ??= [];
    switch (info.link) {
      case 'patientRef':
        if (patientRef) add(info.container, await queryObjects(root, info.container, byPatientRef(patientRef)));
        break;
      case 'patientRef-or-guest-email': {
        if (patientRef) add(info.container, await queryObjects(root, info.container, byPatientRef(patientRef)));
        if (email) {
          const forms = [...new Set([email, email.toLowerCase()])].map(safeEmail);
          add(info.container, await queryObjects(root, info.container, `value(guest(email in (${forms.map((f) => `"${f}"`).join(', ')})))`));
        }
        break;
      }
      case 'key-customer-id': {
        const one = await getObject(root, info.container, ratelimitKey(customerId));
        if (one) add(info.container, [one]);
        break;
      }
      case 'recurring-order-id':
        if (recurringIds.length > 0) add(info.container, await queryObjects(root, info.container, `value(recurringOrderId in (${recurringIds.map((i) => `"${safeId(i)}"`).join(', ')}))`));
        break;
      case 'key-cart-id':
        if (cartIds.length > 0) add(info.container, (await queryObjects(root, info.container)).filter((o) => cartIds.some((id) => String(o.key).startsWith(`${id}_`))));
        break;
      case 'none':
        break;
    }
    note('CustomObject', `custom-objects/${info.container} (${info.link})`, objects[info.container]);
  }
  // A booking's slot claim is pseudonymous (request id only) but is deleted with the booking so the slot is free again.
  for (const b of objects['malva-booking'] ?? []) {
    const v = b.value as { doctorKey?: string; mode?: 'remote' | 'office'; startsAt?: string };
    if (v.doctorKey && v.mode && v.startsAt) {
      const claim = await getObject(root, 'malva-slot-claim', slotClaimKey(v.doctorKey, v.mode, v.startsAt));
      if (claim) add('malva-slot-claim', [claim]);
    }
  }

  // ---- Messages for every resource id found above (the platform writes them; Messages are disabled in this project, so usually none).
  const ids = [
    ...Object.entries(resources).filter(([k]) => k !== 'Message').flatMap(([, rows]) => rows.map((r) => r.id as string)),
    ...recurringOrders.map((r) => r.id as string),
  ];
  const messages: Rec[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    messages.push(...(await queryAll(root, 'messages', `resource(id in (${batch.map((id) => `"${safeId(id)}"`).join(', ')}))`)));
  }
  resources.Message = messages;
  note('Message', `messages?where=resource(id in (<${ids.length} ids found above>))`, messages);

  return { customerId, email, patientRef, resources, recurringOrders, objects, queries };
}
