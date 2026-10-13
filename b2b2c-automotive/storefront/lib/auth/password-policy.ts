// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Password policy (workstream P D7, reused by Q): at least 10 characters and not on the list of common passwords. Pure; no server-only
// so the form can show the rule before it submits (the server decides).
import { isCommonPassword } from '@/lib/auth/common-passwords';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 256;
export type PasswordRule = 'too-short' | 'too-common';
export type PasswordCheck = { ok: true } | { ok: false; rule: PasswordRule };

export function checkPassword(password: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, rule: 'too-short' };
  if (isCommonPassword(password)) return { ok: false, rule: 'too-common' };
  return { ok: true };
}
