// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Live password feedback of Account settings > Security (workstream U-10, decision 19). Pure; client and server use the same rule.

export const MIN_PASSWORD_LENGTH = 12;

export type PasswordState = 'enter' | 'tooShort' | 'mismatch' | 'ok';

/** `enter`: nothing typed; `tooShort`: under 12 characters; `mismatch`: repeat differs; `ok`: valid and matching. */
export function checkPassword(next: string, repeat: string): PasswordState {
  if (next === '') return 'enter';
  if (next.length < MIN_PASSWORD_LENGTH) return 'tooShort';
  if (next !== repeat) return 'mismatch';
  return 'ok';
}

/** The exact texts of the spec (English; the German catalogue carries the translations of the same four states). */
export const PASSWORD_MESSAGES: Record<PasswordState, string> = {
  enter: 'Enter a new password',
  tooShort: 'Too short',
  mismatch: "Passwords don't match",
  ok: 'Looks good',
};

/** What the Update password button reports while the password is not valid. */
export const FIX_PASSWORD_MESSAGE = 'Fix the password first';
