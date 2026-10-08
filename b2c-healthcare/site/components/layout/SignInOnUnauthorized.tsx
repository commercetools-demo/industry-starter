'use client';
import type { ReactNode } from 'react';
import { isUnauthorized } from '@/lib/http';
import { RequireSignIn, type SignInReason } from './RequireSignIn';

/**
 * Client counterpart of `requireSessionOrPrompt`: when a hook's request failed with a 401 (the
 * session expired while the page was open), show the sign-in card for this route instead of the
 * content or an error. Any other error is the caller's to handle (`children`).
 *
 *   const { data, error } = useSWR(KEY, fetcher);
 *   return <SignInOnUnauthorized error={error} reason="cart">{...}</SignInOnUnauthorized>;
 */
export function SignInOnUnauthorized({
  error,
  reason,
  returnTo,
  children,
}: {
  error: unknown;
  reason: SignInReason;
  returnTo?: string;
  children: ReactNode;
}) {
  if (isUnauthorized(error)) return <RequireSignIn reason={reason} returnTo={returnTo} />;
  return <>{children}</>;
}
