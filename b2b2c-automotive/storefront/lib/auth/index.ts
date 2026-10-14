// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Root of the sign-in plumbing: importing it registers every built-in hook. Routes that sign a shopper in import from here.
import 'server-only';
import '@/lib/auth/garage-merge-hook';

export { registerSignInHook, runSignInHooks, type SignInHook, type SignInHookContext } from '@/lib/auth/sign-in-hooks';
