// Shared fake of the commercetools client for the /api/auth route tests: records every request and answers with `world.handler`.
// The `vi.mock` calls themselves stay in each test file (vitest hoists them).
import type { Customer } from '@commercetools/platform-sdk';
import type { SessionData } from '@/lib/session-types';

export type AuthCall = { method: 'GET' | 'POST'; path: string; body?: unknown };

export const world = {
  calls: [] as AuthCall[],
  handler: ((): unknown => ({})) as (call: AuthCall) => unknown,
  session: {} as SessionData,
  patches: [] as Partial<SessionData>[],
};

export const failure = (statusCode: number, code: string, field?: string) =>
  Object.assign(new Error(code), { statusCode, body: { errors: [{ code, ...(field ? { field } : {}) }] } });

function builder(path: string) {
  const run = (method: 'GET' | 'POST', body?: unknown) => async () => ({ body: world.handler((world.calls[world.calls.push({ method, path, ...(body === undefined ? {} : { body }) }) - 1] as AuthCall)) });
  return {
    get: () => ({ execute: run('GET') }),
    post: ({ body }: { body: unknown }) => ({ execute: run('POST', body) }),
  };
}

export const apiRoot = {
  login: () => builder('login'),
  customers: () => ({
    ...builder('customers'),
    emailToken: () => builder('customers/email-token'),
    emailConfirm: () => builder('customers/email/confirm'),
    passwordToken: () => builder('customers/password-token'),
    passwordReset: () => builder('customers/password/reset'),
    withPasswordToken: ({ passwordToken }: { passwordToken: string }) => builder(`customers/password-token=${passwordToken}`),
    withId: ({ ID }: { ID: string }) => builder(`customers/${ID}`),
  }),
};

export const sessionMock = {
  getSession: async (): Promise<SessionData> => world.session,
  updateSession: async (patch: Partial<SessionData>): Promise<SessionData> => {
    world.patches.push(patch);
    world.session = { ...world.session, ...patch };
    for (const key of Object.keys(patch) as (keyof SessionData)[]) if (patch[key] === undefined) delete world.session[key];
    return world.session;
  },
};

export function resetWorld(session: SessionData = {}): void {
  world.calls = [];
  world.handler = () => ({});
  world.session = session;
  world.patches = [];
}

export const ctCustomer = (patch: Partial<Customer> = {}): Customer =>
  ({
    id: 'c-1',
    version: 4,
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    customerNumber: 'MV-12345-5',
    isEmailVerified: true,
    createdAt: '2026-10-07T10:00:00.000Z',
    lastModifiedAt: '2026-10-07T10:00:00.000Z',
    addresses: [],
    authenticationMode: 'Password',
    stores: [],
    ...patch,
  }) as Customer;

let nextIp = 0;
/** A POST with a same-origin Origin header and a fresh client IP (the IP limiter is per process, not resettable). */
export function authRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  nextIp += 1;
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': `10.0.${Math.floor(nextIp / 250)}.${nextIp % 250}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export const sameIp = (ip: string): Record<string, string> => ({ 'x-forwarded-for': ip });
