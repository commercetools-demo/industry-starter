import 'server-only';
import { ApiError } from '../errors';
import { createListCart, readLines, resolveCart, discardCart, type ListSession, type SourceLine } from '../ct/quote-list';
import { compensateRegistration, createQuoteRequest, findQuoteRequest, getRequestContext, prepareRequestCart, type GeneralLine, type RequestFields as QuoteRequestFields, type RequestSite } from '../ct/quote-requests';
import { registerCompany } from '../ct/registration';
import { getStoreChannelData } from '../ct/stores';
import { checkPassword } from '../password';
import { clearCart, setBusinessContext, setCustomer, type Session } from '../session-core';
import type { Service } from '../types';
import { HONEYPOT, IDEMPOTENCY_PATTERN, WASTE_TYPES, type Choice } from './constants';
import { makeReference } from './reference';
import { parseFields, splitName, validateAll, type FieldErrors, type RequestFields } from './validation';

/** A refusal with a machine-readable `code` (and field errors) the form can act on. */
export class QuoteSubmitError extends ApiError {
  constructor(status: number, message: string, public code: string, public fieldErrors?: FieldErrors) {
    super(status, message);
  }
}

export interface SubmitResult { reference: string; session: Session }

const CHOICE_LABEL: Record<Choice, string> = { plumbing: 'Plumbing', waste: 'Waste management', both: 'Plumbing and waste management', unsure: 'Not sure yet' };
const inFlight = new Map<string, Promise<SubmitResult>>();
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * One idempotent action (malva-request-a-quote › Submission creates exactly one request). Concurrent calls with the same
 * key share one attempt; a later call finds the request already created for the key and returns its reference.
 * `session` is the effective session (locale already applied); the returned session is what the cookie should hold.
 */
export async function submitQuoteRequest(session: Session, body: Record<string, unknown>, services: Service[]): Promise<SubmitResult> {
  if (text(body[HONEYPOT])) throw new QuoteSubmitError(400, 'We could not send this request.', 'rejected');
  const key = text(body.idempotencyKey);
  if (!IDEMPOTENCY_PATTERN.test(key)) throw new QuoteSubmitError(400, 'We could not send this request. Please reload the page and try again.', 'invalid-key');
  const running = inFlight.get(key);
  if (running) return running;
  const attempt = run(session, key, parseFields(body.fields), services).finally(() => inFlight.delete(key));
  inFlight.set(key, attempt);
  return attempt;
}

async function run(session: Session, key: string, f: RequestFields, services: Service[]): Promise<SubmitResult> {
  const signedIn = Boolean(session.customerId);
  if (signedIn && !session.businessUnitKey) throw new ApiError(400, 'No active business unit');

  if (signedIn) {
    const existing = await findQuoteRequest(session as Required<Pick<Session, 'customerId' | 'businessUnitKey'>>, key);
    if (existing) return { reference: existing.reference, session: clearCart(session) };
  }

  // The list the visitor built (for a client: the Business Unit's list). Lines of withdrawn services are excluded.
  const { cart } = await resolveCart(session as ListSession);
  const live = new Set(services.map((s) => s.id));
  const present = (cart?.lineItems ?? []).filter((li) => Boolean(li.productId));
  const available = present.filter((li) => live.has(li.productId));
  const dropIds = present.filter((li) => !live.has(li.productId)).map((li) => li.id);
  const lines: SourceLine[] = cart ? readLines({ ...cart, lineItems: available }) : [];
  const needsWaste = available.some((li) => services.find((s) => s.id === li.productId)?.needsWasteDetails);

  const errors = validateAll({ ...f, country: f.country || session.country }, { hasServices: lines.length > 0, signedIn });
  if (!signedIn && !errors.password && checkPassword(f.password)) errors.password = 'passwordCommon';
  if (Object.keys(errors).length) throw new QuoteSubmitError(400, 'Check the highlighted fields.', 'invalid', errors);

  let context: Awaited<ReturnType<typeof getRequestContext>> | undefined;
  if (signedIn) {
    context = await getRequestContext(session);
    if (!context.canSubmit) {
      const who = context.adminName ? `your company administrator, ${context.adminName}` : 'your company administrator';
      throw new QuoteSubmitError(403, `Your role cannot send quote requests. Please ask ${who}.`, 'no-permission');
    }
  }

  const site: RequestSite = { addressLine1: f.addressLine1, ...(f.addressLine2 ? { addressLine2: f.addressLine2 } : {}), city: f.city, postalCode: f.postalCode, country: f.country || session.country };
  const general: GeneralLine | undefined = lines.length === 0 && f.choice ? { name: `General enquiry: ${CHOICE_LABEL[f.choice]}`, slug: `general-${f.choice}` } : undefined;
  const reference = makeReference();
  const wasteLabels = needsWaste ? f.wasteTypes.map((k) => WASTE_TYPES.find((w) => w.key === k)?.label ?? k).join(', ') : '';
  const notes = [f.choice ? `${general ? 'Requested' : 'Also interested in'}: ${CHOICE_LABEL[f.choice as Choice]}.` : '', f.need].filter(Boolean).join(' ');
  const fields: QuoteRequestFields = {
    sector: f.sector, siteCount: f.siteCount, ...(wasteLabels ? { wasteTypes: wasteLabels } : {}), ...(needsWaste && f.permitNumber ? { permitNumber: f.permitNumber } : {}),
    ...(notes ? { notes } : {}), contactName: f.contactName, ...(f.jobTitle ? { jobTitle: f.jobTitle } : {}), ...(f.phone ? { phone: f.phone } : {}), reference,
  };

  if (signedIn) {
    const prepared = await prepareRequestCart(session as ListSession, { cart: cart ?? undefined, general, site, dropLineItemIds: dropIds });
    const made = await createQuoteRequest(session as Required<Pick<Session, 'customerId' | 'businessUnitKey'>>, prepared, key, fields, notes || undefined);
    // The cart stays Active after the request is created and the request keeps its own copy, so the list is deleted: the next list starts empty.
    await discardCart(session as ListSession, prepared);
    return { reference: made.reference, session: clearCart(session) };
  }

  // Visitor without an account: register (customer, company, administrator), then create the request in the same action.
  const name = splitName(f.contactName)!;
  const registered = await registerCompany({ companyName: f.company, sector: f.sector as never, firstName: name.firstName, lastName: name.lastName, jobTitle: f.jobTitle, email: f.email, phone: f.phone, password: f.password });
  if (registered.status === 'duplicate') throw new QuoteSubmitError(409, 'An account may already exist for this email address. Please sign in; everything you entered is kept.', 'account-exists');
  const store = await getStoreChannelData(process.env.CTP_DEFAULT_STORE_KEY ?? 'mpw-web').catch(async (error) => { await compensateRegistration({ customerId: registered.customer.id, businessUnitKey: registered.businessUnitKey }); throw error; });
  let next = setCustomer(session, { customerId: registered.customer.id, customerEmail: registered.customer.email, customerFirstName: registered.customer.firstName, customerLastName: registered.customer.lastName });
  next = clearCart(setBusinessContext(next, { ...store, businessUnitKey: registered.businessUnitKey }));
  let created: Awaited<ReturnType<typeof createListCart>> | undefined;
  try {
    created = await createListCart(next as ListSession, lines);
    created = await prepareRequestCart(next as ListSession, { cart: created, general, site });
    const made = await createQuoteRequest(next as Required<Pick<Session, 'customerId' | 'businessUnitKey'>>, created, key, fields, notes || undefined);
    await discardCart(next as ListSession, created);
    if (cart) await discardCart(session as ListSession, cart);
    return { reference: made.reference, session: next };
  } catch (error) {
    await compensateRegistration({ customerId: registered.customer.id, businessUnitKey: registered.businessUnitKey, cart: created });
    throw error;
  }
}
