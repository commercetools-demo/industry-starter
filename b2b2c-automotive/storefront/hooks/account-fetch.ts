// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Request helper of the account hooks (workstream Q). Unlike `fetchJson` it keeps the machine `error` code of the answer (and the password `rule`),
// so a form can show its own localized message. Only hooks call it; components never fetch `/api` directly.

export class AccountApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly rule?: string,
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'AccountApiError';
  }
}

export async function accountRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let code = 'generic';
    let rule: string | undefined;
    try {
      const data = (await res.json()) as { error?: unknown; rule?: unknown };
      if (typeof data.error === 'string') code = data.error;
      if (typeof data.rule === 'string') rule = data.rule;
    } catch {
      // keep the generic code
    }
    throw new AccountApiError(res.status, code, rule);
  }
  return (await res.json()) as T;
}

export const accountFetcher = <T>(url: string): Promise<T> => accountRequest<T>('GET', url);

/** The machine code of a failed request, `generic` for anything that is not an `AccountApiError`. */
export const errorCodeOf = (error: unknown): string => (error instanceof AccountApiError ? error.code : 'generic');
export const errorRuleOf = (error: unknown): string | undefined => (error instanceof AccountApiError ? error.rule : undefined);
