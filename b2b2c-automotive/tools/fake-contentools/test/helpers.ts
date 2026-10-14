// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { startFakeContentools, type FakeContentools } from '../src/server.ts';
import type { FakeOptions } from '../src/state.ts';

export const PROJECT = 'spec-test-b2b2c-automotive';
export const NORTH = 'mau-reseller-north';
export const SOUTH = 'mau-reseller-south';

export function makeJwt(claims: Record<string, unknown> = { sub: PROJECT }): string {
  const enc = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(claims)}.fake-signature`;
}

export const bearer = (claims?: Record<string, unknown>): Record<string, string> => ({ authorization: `Bearer ${makeJwt(claims)}` });
export const projectHeader: Record<string, string> = { 'x-project-key': PROJECT };

export interface Api {
  fake: () => FakeContentools;
  call: (method: string, path: string, init?: { headers?: Record<string, string>; json?: unknown; body?: BodyInit; rawJson?: string }) => Promise<{ status: number; body: any; headers: Headers; text: string }>;
}

/** Starts one fake per test file on a free port and resets it before every test. */
export function useFake(options: Partial<FakeOptions> = {}): Api {
  let fake: FakeContentools;
  beforeAll(async () => {
    fake = await startFakeContentools({ port: 0, ...options });
  });
  afterAll(async () => {
    await fake.close();
  });
  beforeEach(() => {
    fake.reset();
  });
  return {
    fake: () => fake,
    async call(method, path, init = {}) {
      const headers: Record<string, string> = { ...init.headers };
      let body: BodyInit | undefined = init.body;
      if (init.json !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(init.json);
      } else if (init.rawJson !== undefined) {
        headers['content-type'] = 'application/json';
        body = init.rawJson;
      }
      const res = await fetch(`${fake.url}${path}`, { method, headers, ...(body !== undefined ? { body } : {}) });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = text === '' ? undefined : JSON.parse(text);
      } catch {
        /* keep text */
      }
      return { status: res.status, body: parsed, headers: res.headers, text };
    },
  };
}
