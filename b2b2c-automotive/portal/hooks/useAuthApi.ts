/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import useSWR from 'swr';
import type { DemoAccount } from '@/lib/portal/types';
import { postJson, swrFetcher, type ApiResult } from './http';

export interface RegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

/** Calls of the auth screens. Each returns the parsed result; the screens map it to messages. */
export const authApi = {
  signIn: (email: string, password: string): Promise<ApiResult<{ status: 'ok' | 'pending' }>> => postJson('/api/auth/login', { email, password }),
  signOut: (): Promise<ApiResult<unknown>> => postJson('/api/auth/logout'),
  register: (input: RegisterInput): Promise<ApiResult<{ status: 'created'; message: string }>> => postJson('/api/auth/register', input),
  requestReset: (email: string): Promise<ApiResult<{ message: string; resetPath: string }>> => postJson('/api/auth/reset-request', { email }),
  reset: (token: string, password: string): Promise<ApiResult<{ status: 'reset' }>> => postJson('/api/auth/reset', { token, password }),
  demoSignIn: (customerId: string): Promise<ApiResult<{ status: 'ok' | 'pending' }>> => postJson('/api/auth/demo-login', { customerId }),
};

export function useAuthApi() {
  return authApi;
}

/** Demo accounts for the sign-in picker; only requested when the server rendered the picker (demo login on). */
export function useDemoAccounts(enabled: boolean) {
  const { data, error, isLoading } = useSWR<{ accounts: DemoAccount[] }>(enabled ? '/api/auth/demo-accounts' : null, swrFetcher, { revalidateOnFocus: false });
  return { accounts: data?.accounts, error, isLoading };
}
