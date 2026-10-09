import 'server-only';
import type { Address, BusinessUnit, Cart, CartUpdateAction, QuoteRequest } from '@commercetools/platform-sdk';
import { ApiError } from '../errors';
import type { Session } from '../session-core';
import { getLocalizedString } from '../utils';
import { ADMIN_ROLE_KEY } from './business-units';
import { asAssociate } from './associate';
import { apiRoot, provisioningRoot } from './client';
import { createListCart, mutateCart, type ListSession, type SourceLine } from './quote-list';

export const CREATE_PERMISSION = 'CreateMyQuoteRequestsFromMyCarts';
export const QUOTE_REQUEST_TYPE_KEY = 'mpw-quote-request';
const TAX_CATEGORY_KEY = 'mpw-service-vat';

type AssociateSession = Pick<Session, 'customerId' | 'businessUnitKey'>;
const statusOf = (error: unknown): number | undefined => (error as { statusCode?: number })?.statusCode;

/** A site the signed-in client can choose (an address of the Business Unit). */
export interface SiteOption { id: string; label: string; addressLine1: string; addressLine2?: string; city: string; postalCode: string; country: string }
export interface RequestContext {
  signedIn: boolean;
  /** False when the client's role cannot create quote requests; the page then names the administrator. */
  canSubmit: boolean;
  adminName?: string;
  company?: string;
  sector?: string;
  sites: SiteOption[];
  contact?: { name: string; email: string; jobTitle: string; phone: string };
}

export const siteFromAddress = (a: Address): SiteOption => {
  const line1 = [a.streetName, a.streetNumber].filter(Boolean).join(' ') || a.additionalStreetInfo || '';
  return { id: a.id ?? a.key ?? line1, label: [line1, a.city].filter(Boolean).join(', '), addressLine1: line1, ...(a.streetName && a.additionalStreetInfo ? { addressLine2: a.additionalStreetInfo } : {}), city: a.city ?? '', postalCode: a.postalCode ?? '', country: a.country };
};

const nameOf = (c: { firstName?: string; lastName?: string }) => [c.firstName, c.lastName].filter(Boolean).join(' ');

/** Role check through the unit's association and the roles' permissions (the platform enforces it again on create). */
async function rolePermissions(unit: BusinessUnit, customerId: string): Promise<{ allowed: boolean; adminId?: string }> {
  const mine = unit.associates?.find((a) => a.customer.id === customerId);
  const roleKeys = [...new Set((mine?.associateRoleAssignments ?? []).map((r) => r.associateRole.key).filter((k): k is string => Boolean(k)))];
  const roles = await Promise.all(roleKeys.map((key) => apiRoot.associateRoles().withKey({ key }).get().execute().then((r) => r.body)));
  const admin = unit.associates?.find((a) => a.associateRoleAssignments.some((r) => r.associateRole.key === ADMIN_ROLE_KEY));
  return { allowed: roles.some((r) => r.permissions.includes(CREATE_PERMISSION)), adminId: admin?.customer.id };
}

/** Prefill data for the request form. Anonymous visitors get an empty, submit-able context. */
export async function getRequestContext(session: Pick<Session, 'customerId' | 'businessUnitKey'>): Promise<RequestContext> {
  if (!session.customerId) return { signedIn: false, canSubmit: true, sites: [] };
  const customer = (await apiRoot.customers().withId({ ID: session.customerId }).get().execute()).body;
  const fields = (customer.custom?.fields ?? {}) as Record<string, unknown>;
  const contact = { name: nameOf(customer), email: customer.email, jobTitle: typeof fields.jobTitle === 'string' ? fields.jobTitle : '', phone: typeof fields.phone === 'string' ? fields.phone : '' };
  if (!session.businessUnitKey) return { signedIn: true, canSubmit: false, sites: [], contact };
  const unit = (await apiRoot.businessUnits().withKey({ key: session.businessUnitKey }).get().execute()).body;
  const { allowed, adminId } = await rolePermissions(unit, session.customerId);
  let adminName: string | undefined;
  if (!allowed && adminId) {
    const admin = await apiRoot.customers().withId({ ID: adminId }).get().execute().then((r) => r.body, () => undefined);
    adminName = admin ? nameOf(admin) || admin.email : undefined;
  }
  const sector = (unit.custom?.fields as Record<string, unknown> | undefined)?.sector;
  return { signedIn: true, canSubmit: allowed, ...(adminName ? { adminName } : {}), company: unit.name, ...(typeof sector === 'string' ? { sector } : {}), sites: (unit.addresses ?? []).map(siteFromAddress), contact };
}

export interface RequestSite { addressLine1: string; addressLine2?: string; city: string; postalCode: string; country: string }

/** The line-item part of a request that has no chosen service: one zero-priced custom line so the cart can become a Quote Request. */
export interface GeneralLine { name: string; slug: string }

export interface RequestFields {
  sector: string;
  siteCount: string;
  wasteTypes?: string;
  permitNumber?: string;
  notes?: string;
  contactName: string;
  jobTitle?: string;
  phone?: string;
  reference: string;
}

/**
 * The cart a Quote Request is created from, in the client's Business Unit: single shipping, the site as shipping address,
 * no discount code, a zero-priced line per service. `cart` is the existing Business Unit cart; otherwise a new one is created from `lines`.
 */
export async function prepareRequestCart(s: ListSession, input: { cart?: Cart; lines?: SourceLine[]; general?: GeneralLine; site: RequestSite; /** Lines of services that are no longer available: they are excluded from the request. */ dropLineItemIds?: string[] }): Promise<Cart> {
  let cart = input.cart ?? (await createListCart(s, input.lines ?? []));
  const actions: CartUpdateAction[] = (input.dropLineItemIds ?? []).map((lineItemId) => ({ action: 'removeLineItem', lineItemId }));
  if (input.general && cart.lineItems.length - (input.dropLineItemIds?.length ?? 0) + cart.customLineItems.length === 0) {
    actions.push({ action: 'addCustomLineItem', name: { [s.locale]: input.general.name }, quantity: 1, slug: input.general.slug, money: { currencyCode: s.currency, centAmount: 0 }, taxCategory: { typeId: 'tax-category', key: TAX_CATEGORY_KEY } });
  }
  if (cart.shippingMode !== 'Single') throw new ApiError(400, 'This quote list cannot be requested. Please start a new one.');
  actions.push({
    action: 'setShippingAddress',
    address: { country: input.site.country, streetName: input.site.addressLine1, ...(input.site.addressLine2 ? { additionalStreetInfo: input.site.addressLine2 } : {}), city: input.site.city, postalCode: input.site.postalCode },
  });
  for (const code of cart.discountCodes ?? []) actions.push({ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id: code.discountCode.id } });
  cart = await mutateCart(s, cart, actions);
  if (cart.lineItems.length + cart.customLineItems.length === 0) throw new ApiError(400, 'Please choose a service.');
  return cart;
}

export const quoteRequestKey = (idempotencyKey: string): string => `mpw-qr-${idempotencyKey}`;

/** Creates the Quote Request through the associate chain. A second create with the same key returns the first. */
export async function createQuoteRequest(session: AssociateSession, cart: Cart, idempotencyKey: string, fields: RequestFields, comment?: string): Promise<{ id: string; reference: string }> {
  const key = quoteRequestKey(idempotencyKey);
  const custom = { type: { typeId: 'type' as const, key: QUOTE_REQUEST_TYPE_KEY }, fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== '')) };
  try {
    const { body } = await asAssociate(session).quoteRequests().post({ body: { cart: { typeId: 'cart', id: cart.id }, cartVersion: cart.version, key, ...(comment ? { comment } : {}), custom } }).execute();
    return { id: body.id, reference: fields.reference };
  } catch (error) {
    const body = (error as { body?: { errors?: Array<{ code?: string }> } }).body;
    if (body?.errors?.some((e) => e.code === 'DuplicateField')) {
      const existing = await findQuoteRequest(session, idempotencyKey);
      if (existing) return existing;
    }
    if (statusOf(error) === 403) throw new ApiError(403, 'Your role does not allow sending quote requests. Please ask your company administrator.');
    throw error;
  }
}

const referenceOf = (qr: QuoteRequest): string => String((qr.custom?.fields as Record<string, unknown> | undefined)?.reference ?? '');

/** The request already created for this idempotency key, if any (double submit or reload). */
export async function findQuoteRequest(session: AssociateSession, idempotencyKey: string): Promise<{ id: string; reference: string } | null> {
  try {
    const { body } = await asAssociate(session).quoteRequests().withKey({ key: quoteRequestKey(idempotencyKey) }).get().execute();
    return { id: body.id, reference: referenceOf(body) };
  } catch (error) {
    if ([404, 403].includes(statusOf(error) ?? 0)) return null;
    throw error;
  }
}

/** A row of the portal's quotes and requests screen (workstream R builds the screen on this). No amounts. */
export interface QuoteRequestSummary {
  id: string;
  reference: string;
  /** Platform state: Submitted, Accepted, Rejected, Withdrawn or Cancelled. */
  state: string;
  createdAt: string;
  services: string[];
  site?: string;
  sector?: string;
  siteCount?: string;
}

export const summarizeQuoteRequest = (qr: QuoteRequest, locale: string): QuoteRequestSummary => {
  const f = (qr.custom?.fields ?? {}) as Record<string, unknown>;
  const a = qr.shippingAddress;
  return {
    id: qr.id,
    reference: referenceOf(qr) || qr.key || qr.id,
    state: qr.quoteRequestState,
    createdAt: qr.createdAt,
    services: [...qr.lineItems.map((li) => getLocalizedString(li.name, locale)), ...qr.customLineItems.map((li) => getLocalizedString(li.name, locale))],
    ...(a ? { site: [[a.streetName, a.streetNumber].filter(Boolean).join(' '), a.city].filter(Boolean).join(', ') } : {}),
    ...(typeof f.sector === 'string' ? { sector: f.sector } : {}),
    ...(typeof f.siteCount === 'string' ? { siteCount: f.siteCount } : {}),
  };
};

/** The Business Unit's Quote Requests, newest first (Request appears in the portal). */
export async function listQuoteRequests(session: AssociateSession & { locale?: string }, options: { limit?: number } = {}): Promise<QuoteRequestSummary[]> {
  const { body } = await asAssociate(session).quoteRequests().get({ queryArgs: { sort: ['createdAt desc'], limit: options.limit ?? 50 } }).execute();
  return body.results.map((qr) => summarizeQuoteRequest(qr, session.locale ?? 'en-US'));
}

/** Undo a registration made for this request: the cart, the company and the customer. Each step is best effort and logged. */
export async function compensateRegistration(input: { customerId: string; businessUnitKey: string; cart?: Cart }): Promise<void> {
  const attempt = async (what: string, fn: () => Promise<unknown>) => { try { await fn(); } catch { console.error(`quote request compensation failed: ${what}`); } };
  const { customerId, businessUnitKey, cart } = input;
  if (cart) await attempt('cart', () => asAssociate({ customerId, businessUnitKey }).carts().withId({ ID: cart.id }).delete({ queryArgs: { version: cart.version } }).execute());
  await attempt('company', async () => {
    const unit = (await provisioningRoot.businessUnits().withKey({ key: businessUnitKey }).get().execute()).body;
    await provisioningRoot.businessUnits().withKey({ key: businessUnitKey }).delete({ queryArgs: { version: unit.version } }).execute();
  });
  await attempt('customer', async () => {
    const customer = (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
    await apiRoot.customers().withId({ ID: customerId }).delete({ queryArgs: { version: customer.version } }).execute();
  });
}
