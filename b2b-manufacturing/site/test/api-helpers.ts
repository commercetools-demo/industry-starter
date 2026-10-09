import { expect, vi } from 'vitest';

/** The session a handler sees; tests set it with `mockSession`. */
export const sessionMock = { current: {} as Record<string, string> };
export const mockSession = (session: Record<string, string>) => { sessionMock.current = { locale: 'en-US', currency: 'USD', country: 'US', ...session }; };

type Handler = (...args: never[]) => Promise<Response>;

export async function expectUnauthenticated(handler: Handler, commercetoolsCall: ReturnType<typeof vi.fn>) {
  mockSession({});
  const res = await handler();
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: expect.any(String) });
  expect(commercetoolsCall).not.toHaveBeenCalled();
}

export async function expectNoBusinessUnit(handler: Handler, commercetoolsCall: ReturnType<typeof vi.fn>) {
  mockSession({ customerId: 'c1' });
  const res = await handler();
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'No active business unit' });
  expect(commercetoolsCall).not.toHaveBeenCalled();
}

export async function expectSanitizedError(handler: Handler) {
  mockSession({ customerId: 'c1', businessUnitKey: 'bu' });
  const res = await handler();
  expect(res.status).toBeGreaterThanOrEqual(400);
  const text = JSON.stringify(await res.json());
  expect(text).not.toMatch(/secret|token|authorization|stack|SDK-INTERNAL/i);
}
