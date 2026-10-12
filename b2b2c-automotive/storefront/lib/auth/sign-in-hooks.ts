// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The extension point of sign-in (workstream N-08). Whatever must happen after a customer signed in (and the cart merged) registers a
// hook: the garage merge (registered in `garage-merge-hook.ts`), later the account area. Hooks run in registration order, a failing
// hook is logged (no personal data) and never fails the sign-in. Used by the login route, the registration route and the demo login.
import 'server-only';
import type { Session } from '@/lib/types';

export interface SignInHookContext {
  /** The session before it is written with the customer. */
  session: Session;
  customerId: string;
}
export type SignInHook = (context: SignInHookContext) => Promise<void> | void;

// One list per server process, shared by every route bundle (Next.js may load this module once per route).
const REGISTRY = Symbol.for('malva.signInHooks');
type Holder = { [REGISTRY]?: Map<string, SignInHook> };
const registry = (): Map<string, SignInHook> => {
  const holder = globalThis as unknown as Holder;
  holder[REGISTRY] ??= new Map();
  return holder[REGISTRY];
};

/** Registers a hook under a name (registering the same name again replaces it, so hot reload does not duplicate it). */
export function registerSignInHook(fn: SignInHook, name: string = fn.name || 'anonymous'): void {
  registry().set(name, fn);
}

export async function runSignInHooks(context: SignInHookContext): Promise<void> {
  for (const [name, hook] of registry()) {
    try {
      await hook(context);
    } catch (error) {
      const status = typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
      console.error(`[auth] sign-in hook "${name}" failed${status ? ` with status ${status}` : ''}`);
    }
  }
}

/** For tests. */
export function clearSignInHooks(): void {
  registry().clear();
}
