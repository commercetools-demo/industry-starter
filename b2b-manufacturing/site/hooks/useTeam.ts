'use client';
import useSWR from 'swr';
import { buKey, KEY_TEAM } from '@/lib/cache-keys';
import { readJson, sendJson } from '@/lib/fetcher';
import type { InviteResult, TeamInput, TeamResult, TeamRoleKey } from '@/lib/portal/types';
import { useAccount } from './useAccount';

/** The company's team. Mutations throw SendError with the server's sentence (for example the last-administrator explanation). */
export function useTeam() {
  const { account, isLoading: accountLoading } = useAccount();
  const bu = account?.businessUnitKey;
  const { data, isLoading, mutate } = useSWR(bu ? buKey(KEY_TEAM, bu) : null, () => readJson<TeamResult>('/api/team'));

  async function send(method: 'PATCH' | 'DELETE', id: string, body?: unknown) {
    const next = await sendJson<TeamResult>(`/api/team/${encodeURIComponent(id)}`, method, body);
    await mutate(next, { revalidate: false });
    return next;
  }
  return {
    members: data?.members ?? [], canEdit: data?.canEdit ?? false, isLoading: accountLoading || isLoading, failed: !isLoading && !data && Boolean(bu),
    /** The one-time password is returned to the caller only; it is not put in the cache. */
    invite: async (input: TeamInput) => { const res = await sendJson<InviteResult>('/api/team', 'POST', input); await mutate(); return res; },
    changeRole: (customerId: string, roleKey: TeamRoleKey) => send('PATCH', customerId, { roleKey }),
    remove: (customerId: string) => send('DELETE', customerId),
  };
}
