// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkPassword, FIX_PASSWORD_MESSAGE, PASSWORD_MESSAGES } from './password-check';

describe('checkPassword', () => {
  it('empty gives Enter a new password', () => {
    expect(checkPassword('', '')).toBe('enter');
    expect(PASSWORD_MESSAGES.enter).toBe('Enter a new password');
  });
  it('11 characters is Too short', () => {
    expect(checkPassword('a'.repeat(11), 'a'.repeat(11))).toBe('tooShort');
    expect(PASSWORD_MESSAGES.tooShort).toBe('Too short');
  });
  it('a different repeat is Passwords don\'t match', () => {
    expect(checkPassword('a'.repeat(12), 'a'.repeat(11))).toBe('mismatch');
    expect(PASSWORD_MESSAGES.mismatch).toBe("Passwords don't match");
  });
  it('12 matching characters is Looks good', () => {
    expect(checkPassword('a'.repeat(12), 'a'.repeat(12))).toBe('ok');
    expect(PASSWORD_MESSAGES.ok).toBe('Looks good');
  });
  it('the button message', () => expect(FIX_PASSWORD_MESSAGE).toBe('Fix the password first'));
});
