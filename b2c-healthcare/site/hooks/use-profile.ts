'use client';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { API_ACCOUNT_PASSWORD, API_ACCOUNT_PROFILE } from '@/lib/api-paths';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import type { AccountUser } from '@/lib/types';

export type ProfileResult =
  | { ok: true }
  /** `status` 0: the server could not be reached. `fields` are the 400's per-field problem codes. */
  | { ok: false; status: number; error: string; fields?: Record<string, string> };

async function send(path: string, method: string, body: unknown): Promise<{ result: ProfileResult; data: unknown }> {
  let response: Response;
  try {
    response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { result: { ok: false, status: 0, error: '' }, data: null };
  }
  const data = (await response.json().catch(() => null)) as { error?: string; fields?: Record<string, string> } | null;
  if (response.ok) return { result: { ok: true }, data };
  return { result: { ok: false, status: response.status, error: data?.error ?? '', fields: data?.fields }, data };
}

export interface UseProfile {
  /** Changes first and last name; the header's initials follow (the account key is rewritten). */
  updateName: (firstName: string, lastName: string) => Promise<ProfileResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<ProfileResult>;
}

export function useProfile(): UseProfile {
  const { mutate } = useSWRConfig();
  const updateName = useCallback(
    async (firstName: string, lastName: string) => {
      const { result, data } = await send(API_ACCOUNT_PROFILE, 'PATCH', { firstName, lastName });
      if (result.ok) {
        const user = data as AccountUser | null;
        if (user && typeof user.id === 'string') await mutate(KEY_ACCOUNT, user, { revalidate: false });
      }
      return result;
    },
    [mutate],
  );
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => (await send(API_ACCOUNT_PASSWORD, 'POST', { currentPassword, newPassword })).result, []);
  return { updateName, changePassword };
}
