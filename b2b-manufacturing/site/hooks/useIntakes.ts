/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import useSWR from 'swr';
import { buKey, KEY_INTAKE } from '@/lib/cache-keys';
import { readJson, SendError } from '@/lib/fetcher';
import type { IntakeRecord } from '@/lib/intake/types';
import { useAccount } from './useAccount';

export const INTAKE_POLL_MS = 3000;

/** Recent intakes of the active Business Unit, refreshed every few seconds while any is still in progress. Keyed `[KEY_INTAKE, businessUnitKey]`. */
export function useIntakes() {
  const { account, isLoading: accountLoading } = useAccount();
  const bu = account?.businessUnitKey;
  const { data, isLoading, mutate } = useSWR(bu ? buKey(KEY_INTAKE, bu) : null, () => readJson<{ intakes: IntakeRecord[] }>('/api/intake'), {
    refreshInterval: (latest) => (latest?.intakes.some((i) => i.status === 'processing') ? INTAKE_POLL_MS : 0),
  });
  return { intakes: data?.intakes ?? [], isLoading: accountLoading || isLoading, failed: !isLoading && !data && Boolean(bu), mutate };
}

/** Sends the form as multipart. Throws SendError with the server's safe sentence on failure. */
export async function submitIntake(form: FormData): Promise<{ id: string }> {
  const res = await fetch('/api/intake', { method: 'POST', credentials: 'same-origin', body: form });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !data.id) throw new SendError(data.error ?? 'Request failed', res.status, data as Record<string, unknown>);
  return { id: data.id };
}
