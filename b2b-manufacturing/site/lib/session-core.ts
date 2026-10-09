import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { COUNTRY_CONFIG } from './utils';

/** The only data a session may hold (malva-bff-and-session › Session contents). No password, token, payment or document data. */
export interface Session {
  customerId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  cartId?: string;
  businessUnitKey?: string;
  storeKey?: string;
  storeId?: string;
  distributionChannelId?: string;
  supplyChannelId?: string;
  productSelectionId?: string;
  country: string;
  currency: string;
  locale: string;
}

export const SESSION_FIELDS = ['customerId', 'customerEmail', 'customerFirstName', 'customerLastName', 'cartId', 'businessUnitKey', 'storeKey', 'storeId', 'distributionChannelId', 'supplyChannelId', 'productSelectionId', 'country', 'currency', 'locale'] as const;

export const SESSION_COOKIE = 'malva_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const defaultSession = (locale = 'en-US'): Session => {
  const c = COUNTRY_CONFIG[locale] ?? COUNTRY_CONFIG['en-US'];
  return { locale: c.locale, currency: c.currency, country: c.country };
};

/** Keep only allow-listed string fields, so nothing else can ride along in the cookie. */
export function pick(input: Record<string, unknown>): Partial<Session> {
  const out: Record<string, string> = {};
  for (const key of SESSION_FIELDS) if (typeof input[key] === 'string' && input[key]) out[key] = input[key] as string;
  return out as Partial<Session>;
}

export function secretKey(secret: string | undefined, nodeEnv = process.env.NODE_ENV): Uint8Array {
  if (!secret || (secret.length < 32 && nodeEnv !== 'test')) throw new Error('SESSION_SECRET must be set to at least 32 characters (see site/.env.example)');
  return new TextEncoder().encode(secret);
}

export async function sealSession(session: Session, key: Uint8Array): Promise<string> {
  return new SignJWT(pick(session as unknown as Record<string, unknown>)).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE}s`).sign(key);
}

/** A bad, tampered or expired token is an anonymous empty session, never an error. */
export async function openSession(token: string | undefined, key: Uint8Array, locale = 'en-US'): Promise<Session> {
  const base = defaultSession(locale);
  if (!token) return base;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return { ...base, ...pick(payload as Record<string, unknown>) };
  } catch {
    return base;
  }
}

export const cookieOptions = (nodeEnv = process.env.NODE_ENV) => ({ httpOnly: true, sameSite: 'lax' as const, secure: nodeEnv !== 'development' && nodeEnv !== 'test', path: '/', maxAge: SESSION_MAX_AGE });

const without = (session: Session, fields: (keyof Session)[]): Session => {
  const copy = { ...session };
  for (const field of fields) delete copy[field];
  return copy;
};

/** Sign-out: customer, cart and Business Unit fields go; locale and store fields stay. */
export const clearCustomer = (session: Session): Session => without(session, ['customerId', 'customerEmail', 'customerFirstName', 'customerLastName', 'cartId', 'businessUnitKey']);

/** Quote request or order placed: only the cart goes. */
export const clearCart = (session: Session): Session => without(session, ['cartId']);

/** Business context fields: written together or not at all (malva-business-unit-context › Atomic business-context session fields). */
export interface StoreFields {
  storeKey: string;
  storeId: string;
  distributionChannelId?: string;
  supplyChannelId?: string;
  productSelectionId?: string;
}

const STORE_KEYS = ['storeKey', 'storeId', 'distributionChannelId', 'supplyChannelId', 'productSelectionId'] as const;

const withStore = (session: Session, store: StoreFields): Session => {
  if (!store.storeKey || !store.storeId) throw new Error('A store needs storeKey and storeId');
  const next = without(session, [...STORE_KEYS]);
  for (const key of STORE_KEYS) if (store[key]) next[key] = store[key];
  return next;
};

/** Anonymous sessions get the default store and no Business Unit. */
export const initDefaultStore = (session: Session, store: StoreFields): Session => withStore(without(session, ['businessUnitKey']), store);

/** All of businessUnitKey and the store fields in one update. */
export function setBusinessContext(session: Session, context: StoreFields & { businessUnitKey: string }): Session {
  if (!context.businessUnitKey) throw new Error('setBusinessContext needs businessUnitKey');
  return { ...withStore(session, context), businessUnitKey: context.businessUnitKey };
}

export interface CustomerFields { customerId: string; customerEmail: string; customerFirstName?: string; customerLastName?: string }
export function setCustomer(session: Session, customer: CustomerFields): Session {
  if (!customer.customerId || !customer.customerEmail) throw new Error('setCustomer needs customerId and customerEmail');
  const next = without(session, ['customerFirstName', 'customerLastName']);
  return { ...next, ...pick(customer as unknown as Record<string, unknown>) };
}

export const setCart = (session: Session, cartId: string): Session => {
  if (!cartId) throw new Error('setCart needs a cartId');
  return { ...session, cartId };
};
