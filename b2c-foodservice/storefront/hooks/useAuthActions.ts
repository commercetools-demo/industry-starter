'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { ApiError } from '@/hooks/fetcher';
import { KEY_ACCOUNT, KEY_CART, KEY_CART_COUNT, USER_SCOPED_KEYS } from '@/lib/cache-keys';
import { useRouter } from '@/i18n/routing';
import type { AppCustomer, AuthCart, RuleId } from '@/lib/types';

export interface AuthResult { customer: AppCustomer; cart: AuthCart | null }

export function isUserScopedKey(key: unknown): boolean {
  if (key === KEY_ACCOUNT) return true;
  const first = Array.isArray(key) ? key[0] : key;
  return typeof first === 'string' && USER_SCOPED_KEYS.includes(first);
}

/** An `ApiError` that also carries the domain extras of the auth routes (Q-J-13). */
export class AuthApiError extends ApiError {
  constructor(
    code: string,
    status: number,
    readonly extra: { failed?: RuleId[]; retryAfterSeconds?: number } = {},
  ) {
    super(code, status);
    this.name = 'AuthApiError';
  }
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new AuthApiError('upstream_unavailable', 0);
  }
  if (!res.ok) {
    let code = 'internal_error';
    const extra: { failed?: RuleId[]; retryAfterSeconds?: number } = {};
    try {
      const error = ((await res.json()) as { error?: Record<string, unknown> } | null)?.error ?? {};
      if (typeof error.code === 'string') code = error.code;
      if (Array.isArray(error.failed)) extra.failed = error.failed as RuleId[];
      if (typeof error.retryAfterSeconds === 'number') extra.retryAfterSeconds = error.retryAfterSeconds;
    } catch {
      // non-JSON error body: keep internal_error
    }
    throw new AuthApiError(code, res.status, extra);
  }
  return (await res.json()) as T;
}

/** Sign in, register, demo sign in and sign out. Failures throw `ApiError` with the server's safe code. */
export function useAuthActions() {
  const { mutate } = useSWRConfig();
  const router = useRouter();

  /** The account is known now; the cart count is refetched (the merged bag may differ from the guest bag). */
  const adopt = useCallback(
    async (result: AuthResult) => {
      await mutate(KEY_ACCOUNT, { customer: result.customer }, { revalidate: false });
      // The merged bag may differ from the guest bag: refresh the full cart (workstream I) and the badge.
      await Promise.all([mutate(KEY_CART_COUNT), mutate(KEY_CART)]);
      return result;
    },
    [mutate],
  );

  const signIn = useCallback(
    async (email: string, password: string) => adopt(await post<AuthResult>('/api/auth/login', { email, password })),
    [adopt],
  );
  const demoSignIn = useCallback(
    async (key: string) => adopt(await post<AuthResult>('/api/auth/demo-login', { key })),
    [adopt],
  );
  const register = useCallback(
    async (input: { email: string; password: string; firstName: string; lastName: string }) =>
      adopt(await post<AuthResult>('/api/auth/register', input)),
    [adopt],
  );

  /** Evicts every user-scoped SWR key in both key forms. By default navigates to the sign-in page with a notice. */
  const signOut = useCallback(
    async ({ navigate = true }: { navigate?: boolean } = {}) => {
      try {
        await post('/api/auth/logout');
      } finally {
        await mutate(isUserScopedKey, undefined, { revalidate: false });
        await mutate(KEY_ACCOUNT, { customer: null }, { revalidate: false });
        if (navigate) router.replace('/account/sign-in?notice=signedOut');
      }
    },
    [mutate, router],
  );

  return { signIn, demoSignIn, register, signOut };
}
