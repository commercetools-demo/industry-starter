import { describe, expect, it } from 'vitest';
import { checkEmail, checkName, normalizeEmail, splitFullName, validateRegistration, validateSignIn } from './auth-validation';
import { checkPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-policy';

describe('account-registration-request: shared validation rules', () => {
  it('password: 10 characters minimum, one rule for server and client', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(checkPassword('123456789')).toBe('tooShort');
    expect(checkPassword('1234567890')).toBeNull();
    expect(checkPassword('')).toBe('required');
    expect(checkPassword(undefined)).toBe('required');
    expect(checkPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('tooLong');
  });

  it('email: trimmed, case-insensitive, format checked loosely', () => {
    expect(normalizeEmail('  Sam@Example.COM ')).toBe('sam@example.com');
    expect(checkEmail('sam@example.com')).toBeNull();
    for (const bad of ['sam', 'sam@', '@example.com', 'sam@example', 'sa m@example.com', 'sam@@example.com']) {
      expect(checkEmail(bad), bad).toBe('invalid');
    }
    expect(checkEmail('   ')).toBe('required');
  });

  it('name: required, split into first and last', () => {
    expect(checkName(' ')).toBe('required');
    expect(checkName('Sam Rivera')).toBeNull();
    expect(splitFullName('Sam Rivera')).toEqual({ firstName: 'Sam', lastName: 'Rivera' });
    expect(splitFullName('  Mary Ann  Smith ')).toEqual({ firstName: 'Mary', lastName: 'Ann Smith' });
    expect(splitFullName('Sam')).toEqual({ firstName: 'Sam' });
  });

  it('validateRegistration lists every problem; validateSignIn only needs presence', () => {
    expect(validateRegistration({ name: 'Sam', email: 'sam@example.com', password: 'longenough1' })).toEqual({});
    expect(validateRegistration({})).toEqual({ name: 'required', email: 'required', password: 'required' });
    expect(validateSignIn({ email: 'sam@example.com', password: 'x' })).toEqual({});
    expect(validateSignIn({ email: '', password: '' })).toEqual({ email: 'required', password: 'required' });
  });
});
