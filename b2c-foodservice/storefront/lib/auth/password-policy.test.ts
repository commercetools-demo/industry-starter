import { describe, expect, it } from 'vitest';
import { validatePassword } from '@/lib/auth/password-policy';

describe('password policy', () => {
  it('Password fails policy names the rule it failed', () => {
    expect(validatePassword('short1').failed).toEqual(['min_length']);
    expect(validatePassword('1234567890123').failed).toEqual(['letter']);
    expect(validatePassword('abcdefghijkl').failed).toEqual(['digit']);
    expect(validatePassword(`${'a'.repeat(129)}1`).failed).toEqual(['max_length']);
    expect(validatePassword('QA@Example.com', 'qa@example.com').failed).toContain('not_email');
    expect(validatePassword('qa-person-1', 'qa-person-1@example.com').failed).toContain('not_email');
    expect(validatePassword('qa@example.com1', 'qa@example.com').ok).toBe(true);
  });

  it('Password of 10 characters with a letter and digit passes', () => {
    expect(validatePassword('abcdefghi1')).toEqual({ ok: true, failed: [] });
  });
});
