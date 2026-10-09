import { checkPassword, type PasswordProblem } from '@/lib/password-policy';

// Pure input rules for the sign-in and registration forms. The client uses them for instant
// feedback and the Route Handlers use the very same functions, so the rules cannot drift.

export type FieldProblem = 'required' | 'invalid' | PasswordProblem;
export type RegisterField = 'name' | 'email' | 'password';

// Deliberately loose: one "@", a dot in the domain, no whitespace. The platform and the mail
// server are the real validators; this only catches typos.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export const EMAIL_MAX_LENGTH = 254;
export const NAME_MAX_LENGTH = 100;

/** Trimmed, lower-cased email (commercetools stores emails in lower case). */
export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function checkEmail(value: unknown): 'required' | 'invalid' | null {
  const email = normalizeEmail(value);
  if (!email) return 'required';
  return email.length > EMAIL_MAX_LENGTH || !EMAIL.test(email) ? 'invalid' : null;
}

export function checkName(value: unknown): 'required' | 'invalid' | null {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) return 'required';
  return name.length > NAME_MAX_LENGTH ? 'invalid' : null;
}

/** "Sam Rivera" -> first "Sam", last "Rivera"; "Mary Ann Smith" -> "Mary", "Ann Smith"; one word -> first name only. */
export function splitFullName(value: string): { firstName: string; lastName?: string } {
  const [firstName = '', ...rest] = value.trim().split(/\s+/);
  const lastName = rest.join(' ');
  return lastName ? { firstName, lastName } : { firstName };
}

export type RegisterProblems = Partial<Record<RegisterField, FieldProblem>>;

export function validateRegistration(input: Partial<Record<RegisterField, unknown>>): RegisterProblems {
  const problems: RegisterProblems = {};
  const name = checkName(input.name);
  if (name) problems.name = name;
  const email = checkEmail(input.email);
  if (email) problems.email = email;
  const password = checkPassword(input.password);
  if (password) problems.password = password;
  return problems;
}

/** Sign-in only needs presence: a wrong format is simply "does not match". */
export function validateSignIn(input: { email?: unknown; password?: unknown }): Partial<Record<'email' | 'password', FieldProblem>> {
  const problems: Partial<Record<'email' | 'password', FieldProblem>> = {};
  const email = checkEmail(input.email);
  if (email) problems.email = email;
  if (typeof input.password !== 'string' || input.password.length === 0) problems.password = 'required';
  return problems;
}
