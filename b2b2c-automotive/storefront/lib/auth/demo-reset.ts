// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// On-screen password reset (workstream Q-04, D4, owner answer Q-P01: the project sends no email). Flag helpers and the decoy token.
// SECURITY TRADE-OFF, owner-acknowledged (M-Q02): with the flag on, anyone who knows an email address can reset that account's password.

type Env = Record<string, string | undefined>;

/** `DEMO_ONSCREEN_RESET`: `true` or `false` wins; unset means on outside production and off in production. */
export function isOnScreenResetEnabled(env: Env = process.env): boolean {
  const value = env.DEMO_ONSCREEN_RESET?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** The alphabet and length of a real password token are not documented: the decoy copies the shape of the last real token seen, else this default. */
export const DEFAULT_TOKEN_LENGTH = 43;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export interface TokenShape {
  length: number;
  alphabet: string;
}

/** Length and alphabet class of a token (letters and digits, plus `-` and `_` when it has them). */
export function tokenShape(token: string): TokenShape {
  const extra = [...new Set(token.replace(/[A-Za-z0-9]/g, ''))].join('');
  return { length: token.length, alphabet: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789${extra}` };
}

const SHAPE = Symbol.for('malva.lastTokenShape');
type Holder = { [SHAPE]?: TokenShape };
export const rememberTokenShape = (token: string): void => void ((globalThis as unknown as Holder)[SHAPE] = tokenShape(token));
const lastShape = (): TokenShape => (globalThis as unknown as Holder)[SHAPE] ?? { length: DEFAULT_TOKEN_LENGTH, alphabet: ALPHABET };

/** A random token of the same length and alphabet as a real one. Never valid: it never touches commercetools. */
export function decoyToken(shape: TokenShape = lastShape(), random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(shape.length);
  return [...bytes].map((b) => shape.alphabet[b % shape.alphabet.length]).join('');
}

/** What a token looks like before it is sent to commercetools (a malformed value is the generic invalid-token answer). */
export const isPlausibleToken = (value: string): boolean => /^[A-Za-z0-9._~+/=-]{16,512}$/.test(value);

export function resetPath(locale: string, store: string, token: string): string {
  return `/${locale}/${store}/account/reset-password?token=${encodeURIComponent(token)}`;
}
