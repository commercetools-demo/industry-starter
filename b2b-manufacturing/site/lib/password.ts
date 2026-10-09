import { COMMON_PASSWORDS } from './common-passwords';

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordRule = 'too-short' | 'too-common';

/** The rule a password breaks, or null. Messages name the rule (malva-client-portal › Password rules). */
export function checkPassword(password: string): PasswordRule | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'too-common';
  return null;
}

export const PASSWORD_MESSAGES: Record<PasswordRule, string> = {
  'too-short': `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  'too-common': 'That password is too common. Choose a less guessable one.',
};
