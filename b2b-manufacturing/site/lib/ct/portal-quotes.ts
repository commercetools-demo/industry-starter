import 'server-only';
import type { LineItem, Quote, QuoteRequest, TypedMoney } from '@commercetools/platform-sdk';
import { ApiError } from '../errors';
import type { Money, QuoteLine, QuoteRound, QuoteThread, QuoteThreadDetail, ThreadActions, ThreadStatus } from '../portal/types';
import { asAssociate } from './associate';
import { notFoundError, requireOwnership } from './ownership';
import { canOn, forbidden, getAssociateContext, type AssociateContext } from './team-unit';

type Session = { customerId: string; businessUnitKey: string; locale?: string };

const ID = /^[A-Za-z0-9-]{1,64}$/;
const statusCode = (error: unknown): number | undefined => (error as { statusCode?: number }).statusCode;

/** A resource that is missing, another company's (commercetools answers 400 "not in business-unit"), or not visible to this associate all look the same. */
async function readOrNull<T>(read: () => Promise<{ body: T }>): Promise<T | null> {
  try {
    return (await read()).body;
  } catch (error) {
    if (statusCode(error) === 404 || statusCode(error) === 403 || statusCode(error) === 400) return null;
    throw error;
  }
}

const localize = (value: Record<string, string> | undefined, locale = 'en-US'): string => (value ? value[locale] ?? value[locale.split('-')[0]] ?? Object.values(value)[0] ?? '' : '');
const money = (value?: TypedMoney): Money | undefined => (value ? { centAmount: value.centAmount, currencyCode: value.currencyCode, fractionDigits: value.fractionDigits } : undefined);

/** Quote request states and quote states as one status (malva-client-portal › Quotes and requests). The latest quote wins over the request. */
export function statusOf(request: Pick<QuoteRequest, 'quoteRequestState'> | undefined, latest: Pick<Quote, 'quoteState'> | undefined): ThreadStatus {
  if (latest) {
    switch (latest.quoteState) {
      case 'Pending': case 'RenegotiationAddressed': return 'ready';
      case 'DeclinedForRenegotiation': return 'renegotiation';
      case 'Accepted': return 'accepted';
      case 'Declined': return 'declined';
      default: return 'cancelled';
    }
  }
  switch (request?.quoteRequestState) {
    case 'Submitted': return 'submitted';
    case 'Accepted': return 'preparing';
    case 'Rejected': return 'declined';
    default: return 'cancelled';
  }
}

const fieldOf = (resource: { custom?: { fields?: Record<string, unknown> } }, name: string): string | undefined => {
  const value = resource.custom?.fields?.[name];
  return typeof value === 'string' && value ? value : undefined;
};

function linesOf(items: LineItem[], locale: string | undefined, prices: boolean): QuoteLine[] {
  return items.map((item) => ({
    name: localize(item.name, locale), quantity: item.quantity, frequency: fieldOf(item, 'frequency'), note: fieldOf(item, 'note'),
    ...(prices ? { unitPrice: money(item.price?.value), total: money(item.totalPrice) } : {}),
  }));
}

const isExpired = (quote: Pick<Quote, 'validTo'> | undefined, now: number) => Boolean(quote?.validTo && Date.parse(quote.validTo) < now);

function actionsOf(ctx: AssociateContext, customerId: string, request: QuoteRequest | undefined, latest: Quote | undefined, status: ThreadStatus, expired: boolean): ThreadActions {
  const own = (latest ?? request)?.customer?.id === customerId;
  const open = status === 'ready' && latest !== undefined;
  return {
    accept: open && !expired && canOn(ctx, own, 'AcceptMyQuotes', 'AcceptOthersQuotes'),
    decline: open && canOn(ctx, own, 'DeclineMyQuotes', 'DeclineOthersQuotes'),
    renegotiate: open && latest?.quoteState === 'Pending' && canOn(ctx, own, 'RenegotiateMyQuotes', 'RenegotiateOthersQuotes'),
    cancel: status === 'submitted' && canOn(ctx, own, 'UpdateMyQuoteRequests', 'UpdateOthersQuoteRequests'),
  };
}

const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

export function buildThread(ctx: AssociateContext, customerId: string, locale: string | undefined, request: QuoteRequest | undefined, quotes: Quote[], now = Date.now()): QuoteThreadDetail {
  const rounds = [...quotes].sort(byCreated);
  const latest = rounds[rounds.length - 1];
  const origin = request ?? latest;
  const status = statusOf(request, latest);
  const expired = status === 'ready' && isExpired(latest, now);
  const address = (request ?? latest)?.shippingAddress;
  const lines = linesOf((latest ?? request)?.lineItems ?? [], locale, Boolean(latest));
  const requestId = request?.id ?? latest?.quoteRequest.id ?? '';
  return {
    id: requestId,
    reference: (request && fieldOf(request, 'reference')) ?? (latest && fieldOf(latest, 'reference')) ?? requestId.slice(0, 8).toUpperCase(),
    createdAt: origin?.createdAt ?? '',
    services: [...new Set((request?.lineItems ?? latest?.lineItems ?? []).map((l) => localize(l.name, locale)))],
    site: address?.company ?? address?.streetName ?? '',
    siteKey: address?.key,
    status, rounds: rounds.length, quoteId: latest?.id, validTo: latest?.validTo, expired,
    can: actionsOf(ctx, customerId, request, latest, status, expired),
    lines,
    comment: request?.comment ?? latest?.quoteRequest.obj?.comment,
    history: rounds.map((q): QuoteRound => ({
      quoteId: q.id, createdAt: q.createdAt, status: statusOf(undefined, q), sellerComment: q.sellerComment, buyerComment: q.buyerComment, validTo: q.validTo,
      expired: isExpired(q, now), lines: linesOf(q.lineItems, locale, true), total: money(q.totalPrice),
    })),
  };
}

const toRow = (thread: QuoteThreadDetail): QuoteThread => {
  const row: Partial<QuoteThreadDetail> = { ...thread };
  delete row.lines; delete row.comment; delete row.history;
  return row as QuoteThread;
};

/** Latest first. One row per quote request (a Quote whose request this associate cannot see still gets its own row). */
export async function listThreads(session: Session): Promise<QuoteThread[]> {
  const ctx = await getAssociateContext(session);
  const chain = asAssociate(session);
  const [requests, quotes] = await Promise.all([
    readOrNull(() => chain.quoteRequests().get({ queryArgs: { limit: 100, sort: 'createdAt desc' } }).execute()),
    readOrNull(() => chain.quotes().get({ queryArgs: { limit: 100, sort: 'createdAt desc', expand: ['quoteRequest'] } }).execute()),
  ]);
  const grouped = new Map<string, Quote[]>();
  for (const quote of quotes?.results ?? []) grouped.set(quote.quoteRequest.id, [...(grouped.get(quote.quoteRequest.id) ?? []), quote]);
  const rows: QuoteThreadDetail[] = [];
  for (const request of requests?.results ?? []) {
    rows.push(buildThread(ctx, session.customerId, session.locale, request, grouped.get(request.id) ?? []));
    grouped.delete(request.id);
  }
  for (const orphan of grouped.values()) rows.push(buildThread(ctx, session.customerId, session.locale, undefined, orphan));
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toRow);
}

/** Open requests for the overview block: not accepted, declined or cancelled yet. */
export const OPEN_STATUSES: ThreadStatus[] = ['submitted', 'preparing', 'ready', 'renegotiation'];

export async function listOpenThreads(session: Session): Promise<QuoteThread[]> {
  return (await listThreads(session)).filter((t) => OPEN_STATUSES.includes(t.status));
}

export async function getThread(session: Session, requestId: string): Promise<QuoteThreadDetail> {
  if (!ID.test(requestId)) throw notFoundError();
  const ctx = await getAssociateContext(session);
  const chain = asAssociate(session);
  const [request, quotes] = await Promise.all([
    readOrNull(() => chain.quoteRequests().withId({ ID: requestId }).get().execute()),
    readOrNull(() => chain.quotes().get({ queryArgs: { where: `quoteRequest(id="${requestId}")`, limit: 50, sort: 'createdAt asc', expand: ['quoteRequest'] } }).execute()),
  ]);
  const list = quotes?.results ?? [];
  if (!request && list.length === 0) throw notFoundError();
  requireOwnership(session, (request ?? list[0]).businessUnit?.key);
  return buildThread(ctx, session.customerId, session.locale, request ?? undefined, list);
}

export type QuoteAction = 'accept' | 'decline' | 'renegotiate';

const ACTION_PERMISSIONS: Record<QuoteAction, [string, string]> = {
  accept: ['AcceptMyQuotes', 'AcceptOthersQuotes'],
  decline: ['DeclineMyQuotes', 'DeclineOthersQuotes'],
  renegotiate: ['RenegotiateMyQuotes', 'RenegotiateOthersQuotes'],
};

const STALE = () => new ApiError(409, 'This quote can no longer be changed. Reload to see its current state.');

/** commercetools refusing a transition (400/409) means the state moved on since the page was read. */
function stateError(error: unknown): never {
  if (statusCode(error) === 400 || statusCode(error) === 409) throw STALE();
  if (statusCode(error) === 403) throw forbidden();
  if (statusCode(error) === 404) throw notFoundError();
  throw error;
}

/**
 * Accept, decline or ask a question about a Quote. The permission, the ownership and the state are checked before anything is written;
 * a second call finds the quote no longer Pending and is refused, so an action cannot be repeated.
 */
export async function actOnQuote(session: Session, quoteId: string, action: QuoteAction, buyerComment?: string): Promise<QuoteThreadDetail> {
  if (!ID.test(quoteId)) throw notFoundError();
  const chain = asAssociate(session);
  const [ctx, quote] = await Promise.all([getAssociateContext(session), readOrNull(() => chain.quotes().withId({ ID: quoteId }).get().execute())]);
  if (!quote) throw notFoundError();
  requireOwnership(session, quote.businessUnit?.key);
  const own = quote.customer?.id === session.customerId;
  if (!canOn(ctx, own, ...ACTION_PERMISSIONS[action])) throw forbidden();
  const allowed = action === 'renegotiate' ? quote.quoteState === 'Pending' : quote.quoteState === 'Pending' || quote.quoteState === 'RenegotiationAddressed';
  if (!allowed) throw STALE();
  if (action === 'accept' && isExpired(quote, Date.now())) throw new ApiError(409, 'This quote has expired. Ask for a new one.');
  const comment = buyerComment?.trim();
  if (action === 'renegotiate' && !comment) throw new ApiError(400, 'Write your question or the change you would like.');
  try {
    if (action === 'accept') {
      if (canOn(ctx, own, 'CreateMyOrdersFromMyQuotes', 'CreateOrdersFromOthersQuotes')) {
        await chain.orders().orderQuote().post({ body: { quote: { typeId: 'quote', id: quote.id }, version: quote.version, quoteStateToAccepted: true } }).execute();
      } else {
        await chain.quotes().withId({ ID: quote.id }).post({ body: { version: quote.version, actions: [{ action: 'changeQuoteState', quoteState: 'Accepted' }] } }).execute();
      }
    } else if (action === 'decline') {
      await chain.quotes().withId({ ID: quote.id }).post({ body: { version: quote.version, actions: [{ action: 'changeQuoteState', quoteState: 'Declined' }] } }).execute();
    } else {
      await chain.quotes().withId({ ID: quote.id }).post({ body: { version: quote.version, actions: [{ action: 'requestQuoteRenegotiation', buyerComment: comment! }] } }).execute();
    }
  } catch (error) {
    stateError(error);
  }
  return getThread(session, quote.quoteRequest.id);
}

/** A buyer may withdraw a request that is still Submitted. */
export async function cancelRequest(session: Session, requestId: string): Promise<QuoteThreadDetail> {
  if (!ID.test(requestId)) throw notFoundError();
  const chain = asAssociate(session);
  const [ctx, request] = await Promise.all([getAssociateContext(session), readOrNull(() => chain.quoteRequests().withId({ ID: requestId }).get().execute())]);
  if (!request) throw notFoundError();
  requireOwnership(session, request.businessUnit?.key);
  if (!canOn(ctx, request.customer?.id === session.customerId, 'UpdateMyQuoteRequests', 'UpdateOthersQuoteRequests')) throw forbidden();
  if (request.quoteRequestState !== 'Submitted') throw STALE();
  try {
    await chain.quoteRequests().withId({ ID: request.id }).post({ body: { version: request.version, actions: [{ action: 'changeQuoteRequestState', quoteRequestState: 'Cancelled' }] } }).execute();
  } catch (error) {
    stateError(error);
  }
  return getThread(session, request.id);
}
