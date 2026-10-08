import 'server-only';
import type { ReactElement } from 'react';
import { RequireSignIn, type SignInReason } from '@/components/layout/RequireSignIn';
import { getSession } from '@/lib/session';

export type SessionGate = { signedIn: true; customerId: string } | { signedIn: false; prompt: ReactElement };

/**
 * For a server page or layout under a patient route. A missing or expired session is NOT a refusal:
 * it yields the `RequireSignIn` card (which links to sign-in with this route as `?next=`), never an
 * "access denied" page and never patient data.
 *
 *   const gate = await requireSessionOrPrompt('cart');
 *   if (!gate.signedIn) return gate.prompt;
 *   // gate.customerId is safe to use from here
 *
 * `getSession()` returns an empty session for an invalid or expired cookie, so both cases land here.
 */
export async function requireSessionOrPrompt(reason: SignInReason, returnTo?: string): Promise<SessionGate> {
  const session = await getSession();
  if (!session.customerId) return { signedIn: false, prompt: <RequireSignIn reason={reason} returnTo={returnTo} /> };
  return { signedIn: true, customerId: session.customerId };
}
