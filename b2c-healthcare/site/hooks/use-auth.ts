'use client';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { useRouter } from '@/i18n/routing';
import { API_AUTH_LOGIN, API_AUTH_LOGOUT, API_AUTH_REGISTER } from '@/lib/api-paths';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';
import type { AccountUser } from '@/lib/types';
import { useClearPatientState } from './sign-out';

export type AuthResult =
  | { ok: true; user: AccountUser }
  | {
      ok: false;
      /** HTTP status; 0 when the server could not be reached. */
      status: number;
      /** Safe server text, empty for a network failure. */
      error: string;
      /** Per-field problem codes of a 400 (`required`, `invalid`, `tooShort`, ...). */
      fields?: Record<string, string>;
    };

async function post(path: string, body: unknown): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, error: '' };
  }
  const data = (await response.json().catch(() => null)) as (AccountUser & { error?: string; fields?: Record<string, string> }) | null;
  if (response.ok && data && typeof data.id === 'string') {
    const { id, firstName, lastName, email } = data;
    return { ok: true, user: { id, firstName, lastName, email } };
  }
  return { ok: false, status: response.status, error: data?.error ?? '', fields: data?.fields };
}

export interface Auth {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  /** Ends the session, clears the patient-scoped client state and goes to the sign-in page. */
  signOut: () => Promise<boolean>;
}

/**
 * Client side of the session lifecycle. A successful sign-in or registration writes the user into the account key
 * and revalidates the cart key (the sign-in may have merged the anonymous cart); the caller navigates.
 */
export function useAuth(): Auth {
  const { mutate } = useSWRConfig();
  const clear = useClearPatientState();
  const router = useRouter();

  const adopt = useCallback(
    async (result: AuthResult): Promise<AuthResult> => {
      if (result.ok) {
        await mutate(KEY_ACCOUNT, result.user, { revalidate: false });
        await mutate(KEY_CART);
      }
      return result;
    },
    [mutate],
  );

  const signIn = useCallback((email: string, password: string) => post(API_AUTH_LOGIN, { email, password }).then(adopt), [adopt]);
  const register = useCallback(
    (name: string, email: string, password: string) => post(API_AUTH_REGISTER, { name, email, password }).then(adopt),
    [adopt],
  );
  const signOut = useCallback(async () => {
    try {
      const response = await fetch(API_AUTH_LOGOUT, { method: 'POST' });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    await clear();
    router.replace('/login');
    router.refresh();
    return true;
  }, [clear, router]);

  return { signIn, register, signOut };
}
