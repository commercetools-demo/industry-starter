/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { useSearchParams } from 'next/navigation';
import { SignInForm } from '@/components/auth/SignInForm';

/** Reads `?next=` in the browser so the page itself stays static. */
export function SignInClient() {
  return <SignInForm next={useSearchParams().get('next')} autoFocus />;
}
