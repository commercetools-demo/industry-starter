import 'server-only';
import { ApiError } from '@/lib/api';
import type { SessionData } from '@/lib/session';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

/** One body and one status for an order that is not the signed-in customer's and for one that does not exist. */
export const ORDER_NOT_FOUND = 'Order not found.';
export const orderNotFound = () => new ApiError(404, ORDER_NOT_FOUND);

export const localeOfSession = (session: Pick<SessionData, 'locale'>): string => (session.locale && isSupportedLocale(session.locale) ? session.locale : DEFAULT_LOCALE);
