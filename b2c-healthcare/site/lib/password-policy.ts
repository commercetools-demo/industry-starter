/**
 * Password rule shared by the server (register, change password) and the client form, so both
 * accept and refuse exactly the same inputs. No composition rules: length is what matters.
 */
export const PASSWORD_MIN_LENGTH = 10;
/** Upper bound so a huge body is not hashed; far above any real passphrase. */
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordProblem = 'required' | 'tooShort' | 'tooLong';

/** `null` when the password is acceptable. Counts characters as typed (code points), not bytes. */
export function checkPassword(password: unknown): PasswordProblem | null {
  if (typeof password !== 'string' || password.length === 0) return 'required';
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (length > PASSWORD_MAX_LENGTH) return 'tooLong';
  return null;
}
