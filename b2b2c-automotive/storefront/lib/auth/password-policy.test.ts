// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS } from './common-passwords';
import { MIN_PASSWORD_LENGTH, checkPassword } from './password-policy';

describe('password policy', () => {
  it('rejects shorter than 10', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(checkPassword('Abc123!xy')).toEqual({ ok: false, rule: 'too-short' });
    expect(checkPassword('')).toEqual({ ok: false, rule: 'too-short' });
  });
  it('rejects common password', () => {
    expect(checkPassword('password123')).toEqual({ ok: false, rule: 'too-common' });
    expect(checkPassword('PassWord123')).toEqual({ ok: false, rule: 'too-common' });
    expect(checkPassword('1234567890')).toEqual({ ok: false, rule: 'too-common' });
  });
  it('accepts a long passphrase', () => {
    expect(checkPassword('correct horse battery staple')).toEqual({ ok: true });
    expect(checkPassword('Tr0ub4dor&3xyz')).toEqual({ ok: true });
  });
  it('the embedded list has about 200 entries, all long enough to matter', () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThanOrEqual(200);
    for (const p of COMMON_PASSWORDS) expect(p.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH - 1);
  });
});
