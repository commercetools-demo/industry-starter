'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { ACCOUNT_KEY_PREFIX, KEY_CART, KEY_SESSION } from '@/lib/cache-keys';
import type { AccountUser, Cart, MergeNote } from '@/lib/types';

/** A refused or failed auth request. `code` is the stable code of the auth API (`INVALID_CREDENTIALS`, `WEAK_PASSWORD`, ...) or `NETWORK`. */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface SignedIn {
  user: AccountUser;
  /** The merged bundle (null when the customer has none). */
  cart: Cart | null;
  mergeNotes: MergeNote[];
  /** Locale-prefixed same-site path to go to next. */
  redirectTo: string;
}

export interface LoginArgs {
  email: string;
  password: string;
  returnTo?: string | undefined;
  locale: string;
}
export interface RegisterArgs extends LoginArgs {
  firstName: string;
  lastName: string;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new AuthError('NETWORK', 'The service is temporarily unavailable', 0);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const error = (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } } | undefined)?.error;
    throw new AuthError(
      typeof error?.code === 'string' ? error.code : 'UNKNOWN',
      typeof error?.message === 'string' ? error.message : 'The service is temporarily unavailable',
      response.status,
      typeof error?.details === 'object' && error.details !== null ? (error.details as Record<string, unknown>) : undefined,
    );
  }
  if (typeof payload !== 'object' || payload === null) throw new AuthError('UNKNOWN', 'The service is temporarily unavailable', response.status);
  return payload as T;
}

export interface AuthMutations {
  login: (args: LoginArgs) => Promise<SignedIn>;
  register: (args: RegisterArgs) => Promise<SignedIn>;
  logout: () => Promise<void>;
  forgotPassword: (args: { email: string; locale: string }) => Promise<{ ok: true; demoLink?: string }>;
  resetPassword: (args: { token: string; password: string; locale: string }) => Promise<{ ok: true; redirectTo: string }>;
}

/**
 * Client calls of the five auth routes. After a sign-in the merged bundle is written into the SWR cache of `KEY_CART` (never
 * refetched, never computed here) and the session summary is revalidated; lines the rules flag after the merge are announced in a
 * toast, so nothing changes silently. The caller navigates (`router.replace` + `router.refresh`).
 */
export function useAuthMutations(): AuthMutations {
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const t = useTranslations('auth');

  const finishSignIn = useCallback(
    async (result: SignedIn): Promise<SignedIn> => {
      await mutate(KEY_CART, result.cart, { revalidate: false });
      await mutate(KEY_SESSION);
      for (const note of result.mergeNotes) {
        toast.show({ message: t('mergeNote.review', { count: note.count, names: note.names }), actionLabel: t('mergeNote.action'), href: '/bundle' });
      }
      return result;
    },
    [mutate, toast, t],
  );

  const login = useCallback(async (args: LoginArgs) => finishSignIn(await post<SignedIn>('/api/auth/login', args)), [finishSignIn]);
  const register = useCallback(async (args: RegisterArgs) => finishSignIn(await post<SignedIn>('/api/auth/register', args)), [finishSignIn]);

  const logout = useCallback(async () => {
    await post<{ ok: true }>('/api/auth/logout', {});
    await mutate(KEY_CART, null, { revalidate: false });
    await mutate((key) => typeof key === 'string' && key.startsWith(ACCOUNT_KEY_PREFIX), undefined, { revalidate: false }); // T: addresses, cards, lists
    await mutate(KEY_SESSION);
  }, [mutate]);

  const forgotPassword = useCallback((args: { email: string; locale: string }) => post<{ ok: true; demoLink?: string }>('/api/auth/forgot-password', args), []);
  const resetPassword = useCallback((args: { token: string; password: string; locale: string }) => post<{ ok: true; redirectTo: string }>('/api/auth/reset-password', args), []);

  return useMemo(() => ({ login, register, logout, forgotPassword, resetPassword }), [login, register, logout, forgotPassword, resetPassword]);
}
