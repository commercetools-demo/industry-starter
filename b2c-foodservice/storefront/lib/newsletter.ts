const MAX_EMAIL_LENGTH = 254;
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Shared by the newsletter form and its route so both agree. Trims first; the caller sends the trimmed value. */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && SHAPE.test(email);
}
