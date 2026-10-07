import { checkPassword, PASSWORD_POLICY } from './password';

describe('checkPassword', () => {
  const table: [string, string, string[]][] = [
    ['a valid password', 'Aa1-valid-pass', []],
    ['too short', 'Aa1-short', ['min-length']],
    ['no lowercase', 'AAAAAAAAAA1', ['lowercase']],
    ['no uppercase', 'aaaaaaaaaa1', ['uppercase']],
    ['no digit', 'Aaaaaaaaaaa', ['digit']],
    ['everything missing', '', ['min-length', 'lowercase', 'uppercase', 'digit']],
  ];
  it.each(table)('%s', (_name, password, failed) => {
    const result = checkPassword(password);
    expect(result.failed).toEqual(failed);
    expect(result.ok).toBe(failed.length === 0);
  });

  it('Password fails policy: each rule is named', () => {
    expect(checkPassword('short').failed).toEqual(['min-length', 'uppercase', 'digit']);
    expect(checkPassword('LOWERCASE1ABC').failed).toEqual(['lowercase']);
  });

  it('the maximum length is 128 and the password is never trimmed', () => {
    const base = 'Aa1';
    expect(checkPassword(base + 'x'.repeat(PASSWORD_POLICY.maxLength - 3)).ok).toBe(true);
    expect(checkPassword(base + 'x'.repeat(PASSWORD_POLICY.maxLength - 2)).failed).toEqual(['max-length']);
    expect(checkPassword('Aa1       ').failed).toEqual([]);
    expect(checkPassword('Aa1      ').failed).toEqual(['min-length']);
  });

  it('refuses a password containing a local part of at least 4 characters, case-insensitively', () => {
    const result = checkPassword('Xx1-JANE.doe-pw', { email: 'jane.doe@example.com' });
    expect(result.failed).toEqual(['not-email']);
    expect(result.passed).not.toContain('not-email');
  });

  it('ignores a local part shorter than 4 characters and a missing email', () => {
    expect(checkPassword('Xx1-abc-password', { email: 'abc@example.com' }).ok).toBe(true);
    expect(checkPassword('Xx1-jane-password').ok).toBe(true);
  });

  it('keeps a stable order of failed and passed rules', () => {
    const result = checkPassword('x');
    expect(result.failed).toEqual(['min-length', 'uppercase', 'digit']);
    expect(result.passed).toEqual(['max-length', 'lowercase', 'not-email']);
  });
});
