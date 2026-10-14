/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { CopilotPlan } from '@/lib/portal/copilot';
import { postJson } from './http';

/** Asks the server what to answer or propose; nothing changes until `applyCopilotAction`. */
export async function planCopilot(text: string, locale: string): Promise<CopilotPlan | null> {
  const result = await postJson<CopilotPlan>('/api/copilot/plan', { text, locale });
  return result.data;
}

/** Runs a change the user confirmed (the server re-checks the permission). */
export async function applyCopilotAction(actionId: string, params: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const result = await postJson<{ ok: boolean; message: string }>('/api/copilot/apply', { actionId, params });
  if (result.data) return result.data;
  return { ok: false, message: result.error ?? 'Something went wrong' };
}

/** Ends a customer session (the banner's Exit button). */
export async function exitCustomerSession(): Promise<boolean> {
  return (await postJson('/api/seller/impersonation/exit')).ok;
}
